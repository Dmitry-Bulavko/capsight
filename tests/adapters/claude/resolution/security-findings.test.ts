import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  isIneffectiveAllowGlob,
  isSensitiveAllowedToolPattern,
  resolveSecurityFindings,
} from "../../../../src/adapters/claude/resolution/security-findings.js";
import type {
  Agent,
  PlatformVersion,
  ProjectSnapshot,
  ResolvedCapability,
  SourceInfo,
  TrustState,
} from "../../../../src/core/model/index.js";
import type { DiscoveredSkill, SettingsLayer } from "../../../../src/adapters/claude/discovery/types.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

const AGENT_SOURCE: SourceInfo = {
  platform: "claude",
  scope: "project",
  path: ".claude/agents/backend.md",
};

const VERSION: PlatformVersion = {
  platform: "claude",
  version: "2.1.0",
  raw: "2.1.0",
  detectedAt: "2026-01-01T00:00:00.000Z",
};

const TRUST: TrustState = {
  accepted: false,
  projectPath: "/workspace/project",
};

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "backend",
    name: "backend",
    description: "Backend agent",
    source: AGENT_SOURCE,
    status: "active",
    configuration: {
      tools: ["Read"],
      unknownFields: {},
    },
    isPluginAgent: false,
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    id: "snapshot-1",
    projectPath: "/workspace/project",
    version: VERSION,
    environment: { relevant: [] },
    trust: TRUST,
    agents: [makeAgent()],
    skills: [],
    instructions: [],
    mcpServers: [],
    settings: [],
    warnings: [],
    scannedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function toolCapability(toolName: string, status: ResolvedCapability["status"]): ResolvedCapability {
  return {
    capabilityId: toolName,
    kind: "tool",
    status,
    enforcement: "enforced",
    sources: [AGENT_SOURCE],
    reasons: [{ type: "declared", message: "test" }],
  };
}

async function writeSkill(
  name: string,
  frontmatter: Record<string, unknown>,
): Promise<DiscoveredSkill> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "capsight-skill-"));
  tempDirs.push(dir);
  const skillPath = path.join(dir, "SKILL.md");
  const yaml = Object.entries(frontmatter)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}:\n${value.map((entry) => `  - ${JSON.stringify(entry)}`).join("\n")}`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    })
    .join("\n");
  await fs.writeFile(skillPath, `---\n${yaml}\n---\nSkill body.\n`);

  return {
    id: `skill-${name}`,
    name,
    source: { platform: "claude", scope: "project", path: skillPath },
    path: skillPath,
  };
}

async function makeSettingsLayer(content: Record<string, unknown>): Promise<SettingsLayer> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "capsight-settings-"));
  tempDirs.push(dir);
  const filePath = path.join(dir, "settings.json");
  await fs.writeFile(filePath, JSON.stringify(content, null, 2));
  return { scope: "project", path: filePath, priority: 30 };
}

describe("security-findings helpers", () => {
  it("detects sensitive allowed-tools patterns", () => {
    expect(isSensitiveAllowedToolPattern("Bash(git *)")).toBe(true);
    expect(isSensitiveAllowedToolPattern("Bash")).toBe(true);
    expect(isSensitiveAllowedToolPattern("Read")).toBe(false);
    expect(isSensitiveAllowedToolPattern("Grep")).toBe(false);
  });

  it("detects ineffective allow globs (S4)", () => {
    expect(isIneffectiveAllowGlob("*")).toBe(true);
    expect(isIneffectiveAllowGlob("mcp__*")).toBe(true);
    expect(isIneffectiveAllowGlob("Read")).toBe(false);
    expect(isIneffectiveAllowGlob("mcp__github")).toBe(false);
  });
});

describe("resolveSecurityFindings", () => {
  it("emits Bash guardrail when restrictions coexist with Bash access", async () => {
    const agent = makeAgent({
      configuration: {
        tools: ["Read", "Bash"],
        disallowedTools: ["Write"],
        unknownFields: {},
      },
    });

    const warnings = await resolveSecurityFindings({
      agent,
      snapshot: makeSnapshot(),
      toolCapabilities: [toolCapability("Bash", "available")],
    });

    expect(warnings.some((warning) => warning.message.includes("guardrail"))).toBe(true);
  });

  it("flags bypassPermissions in agent definition", async () => {
    const agent = makeAgent({
      configuration: {
        permissionMode: "bypassPermissions",
        unknownFields: {},
      },
    });

    const warnings = await resolveSecurityFindings({
      agent,
      snapshot: makeSnapshot(),
      toolCapabilities: [],
    });

    expect(warnings.some((warning) => warning.matrixRef === "P5")).toBe(true);
    expect(warnings.some((warning) => warning.message.includes("bypassPermissions"))).toBe(true);
  });

  it("flags inline MCP servers that run arbitrary commands", async () => {
    const agent = makeAgent({
      configuration: {
        tools: ["Read"],
        mcpServers: [{ transport: "stdio", commandName: "node", envKeys: [], headerKeys: [] }],
        unknownFields: {},
      },
    });

    const warnings = await resolveSecurityFindings({
      agent,
      snapshot: makeSnapshot(),
      toolCapabilities: [],
    });

    expect(warnings.some((warning) => warning.message.includes("arbitrary command"))).toBe(true);
    expect(warnings.some((warning) => warning.matrixRef === "R1")).toBe(true);
  });

  it("flags skill allowed-tools that pre-approve sensitive tools (K6, K7)", async () => {
    const skill = await writeSkill("git-helper", {
      name: "git-helper",
      "allowed-tools": ["Bash(git *)", "Read"],
    });

    const warnings = await resolveSecurityFindings({
      agent: makeAgent(),
      snapshot: makeSnapshot({ skills: [skill] }),
      toolCapabilities: [],
    });

    expect(warnings.some((warning) => warning.matrixRef === "K6")).toBe(true);
    expect(warnings.some((warning) => warning.message.includes('Bash(git *)'))).toBe(true);
    expect(warnings.filter((warning) => warning.matrixRef === "K6")).toHaveLength(1);
  });

  it("flags ineffective permissions.allow globs (S4)", async () => {
    const settingsLayer = await makeSettingsLayer({
      permissions: {
        allow: ["Read", "*", "mcp__*"],
      },
    });

    const warnings = await resolveSecurityFindings({
      agent: makeAgent(),
      snapshot: makeSnapshot({ settings: [settingsLayer] }),
      toolCapabilities: [],
    });

    const s4Warnings = warnings.filter((warning) => warning.matrixRef === "S4");
    expect(s4Warnings).toHaveLength(2);
    expect(s4Warnings.some((warning) => warning.message.includes('"*"'))).toBe(true);
    expect(s4Warnings.some((warning) => warning.message.includes('"mcp__*"'))).toBe(true);
  });
});
