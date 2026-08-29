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
  PlatformVersion,
  ResolvedCapability,
  SourceInfo,
  TrustState,
} from "../../../../src/core/model/index.js";
import type {
  ClaudeAgent as Agent,
  ClaudeProjectSnapshot as ProjectSnapshot,
} from "../../../../src/adapters/claude/model/index.js";
import type { DiscoveredSkill, SettingsLayer } from "../../../../src/adapters/claude/discovery/types.js";
import { readSettingsPermissions } from "../../../../src/adapters/claude/discovery/settings.js";

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
  // Layers carry their parsed `permissions` block from discovery onwards, so
  // the fake layer is built by the same reader the scanner uses.
  const permissions = await readSettingsPermissions(filePath);
  return {
    scope: "project",
    path: filePath,
    priority: 30,
    ...(permissions ? { permissions } : {}),
  };
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

  // F9: the same declaration is a real finding for a project agent and an
  // ignored field for a plugin one. Asserting both halves is what keeps the
  // finding from drifting back into contradicting the `ignored-field` warning.
  it("drops F9-nullified findings for a plugin agent but keeps them for a project agent", async () => {
    const configuration = {
      tools: ["Read"],
      permissionMode: "bypassPermissions" as const,
      mcpServers: [
        {
          transport: "stdio" as const,
          commandName: "audit-server",
          envKeys: [],
          headerKeys: [],
        },
      ],
      unknownFields: {},
    };

    const projectWarnings = await resolveSecurityFindings({
      agent: makeAgent({ configuration }),
      snapshot: makeSnapshot(),
      toolCapabilities: [],
    });
    const pluginWarnings = await resolveSecurityFindings({
      agent: makeAgent({ configuration, isPluginAgent: true }),
      snapshot: makeSnapshot(),
      toolCapabilities: [],
    });

    expect(projectWarnings.map((warning) => warning.matrixRef)).toEqual(["P5", "R1"]);
    expect(pluginWarnings).toEqual([]);
  });

  it("keeps findings a plugin agent cannot nullify (K6, S4)", async () => {
    const skill = await writeSkill("git-helper", {
      name: "git-helper",
      "allowed-tools": ["Bash(git *)"],
    });
    const settingsLayer = await makeSettingsLayer({ permissions: { allow: ["*"] } });
    const snapshot = makeSnapshot({ skills: [skill], settings: [settingsLayer] });

    const warnings = await resolveSecurityFindings({
      agent: makeAgent({
        configuration: {
          tools: ["Read", "Bash"],
          disallowedTools: ["Write"],
          unknownFields: {},
        },
        isPluginAgent: true,
      }),
      snapshot,
      toolCapabilities: [toolCapability("Bash", "available")],
    });

    expect(warnings.some((warning) => warning.message.includes("guardrail"))).toBe(true);
    expect(warnings.some((warning) => warning.matrixRef === "K6")).toBe(true);
    expect(
      warnings.some((warning) => warning.matrixRef === "settings.allowGlobIneffective"),
    ).toBe(true);
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

    // The finding is a platform claim, so it carries the matrix entry it was
    // gated on rather than the bare fact id.
    const s4Warnings = warnings.filter(
      (warning) => warning.matrixRef === "settings.allowGlobIneffective",
    );
    expect(s4Warnings).toHaveLength(2);
    expect(s4Warnings.every((warning) => warning.enforcement === "enforced")).toBe(true);
    expect(s4Warnings.some((warning) => warning.message.includes('"*"'))).toBe(true);
    expect(s4Warnings.some((warning) => warning.message.includes('"mcp__*"'))).toBe(true);
  });
});
