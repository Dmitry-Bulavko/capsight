import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveEffectiveConfiguration } from "../../../../src/adapters/claude/resolution/resolver.js";
import { resolve } from "../../../../src/application/resolve.js";
import { buildExecutionContext } from "../../../../src/core/resolver/context.js";
import { FACT } from "../../../../src/adapters/claude/version/facts.js";
import type {
  Agent,
  PlatformVersion,
  ProjectSnapshot,
  SourceInfo,
  TrustState,
} from "../../../../src/core/model/index.js";
import type { DiscoveredInstruction, DiscoveredMcpServer, SettingsLayer } from "../../../../src/adapters/claude/discovery/types.js";

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

const TRUST_DENIED: TrustState = {
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
      tools: ["Read", "Write", "Grep", "Bash", "Agent", "mcp__github__merge_pr"],
      disallowedTools: ["Bash"],
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
    trust: TRUST_DENIED,
    agents: [makeAgent()],
    skills: [],
    instructions: [
      {
        id: "instruction-1",
        type: "CLAUDE.md",
        path: "CLAUDE.md",
        scope: "project",
        sizeBytes: 128,
      } satisfies DiscoveredInstruction,
    ],
    mcpServers: [
      {
        id: "mcp-github",
        source: {
          platform: "claude",
          scope: "project",
          path: ".mcp.json",
        },
        configPath: ".mcp.json",
        transport: "stdio",
        status: "configured",
      } satisfies DiscoveredMcpServer,
    ],
    settings: [],
    warnings: [],
    scannedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function toolCapability(
  result: Awaited<ReturnType<typeof resolveEffectiveConfiguration>>,
  toolName: string,
) {
  return result.capabilities.find(
    (capability) =>
      capability.capabilityId === toolName &&
      (capability.kind === "tool" || capability.kind === "mcp_tool"),
  );
}

function assertCapabilityContract(
  capabilities: Awaited<ReturnType<typeof resolveEffectiveConfiguration>>["capabilities"],
): void {
  for (const capability of capabilities) {
    expect(capability.sources.length).toBeGreaterThanOrEqual(1);
    expect(capability.reasons.length).toBeGreaterThanOrEqual(1);
  }
}

async function makeSettingsLayer(content: Record<string, unknown>): Promise<SettingsLayer> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "capsight-resolver-"));
  tempDirs.push(dir);
  const filePath = path.join(dir, "settings.json");
  await fs.writeFile(filePath, JSON.stringify(content, null, 2));
  return { scope: "project", path: filePath, priority: 30 };
}

describe("resolveEffectiveConfiguration", () => {
  it("throws when agent is missing", async () => {
    await expect(
      resolveEffectiveConfiguration(makeSnapshot({ agents: [] }), "backend", buildExecutionContext("main-session")),
    ).rejects.toThrow(/Agent not found: backend/);
  });

  it("returns permission, tool, mcp, and instruction capabilities with sources and reasons", async () => {
    const result = await resolveEffectiveConfiguration(
      makeSnapshot(),
      "backend",
      buildExecutionContext("foreground-subagent"),
    );

    assertCapabilityContract(result.capabilities);
    expect(result.capabilities.some((capability) => capability.kind === "permission")).toBe(true);
    expect(toolCapability(result, "Read")?.status).toBe("available");
    expect(toolCapability(result, "Bash")?.status).toBe("denied");
    expect(result.capabilities.some((capability) => capability.kind === "mcp_server")).toBe(true);
    expect(result.capabilities.filter((capability) => capability.kind === "instruction")).toHaveLength(1);
    expect(result.agentId).toBe("backend");
    expect(result.version).toEqual(VERSION);
  });

  it("differs between foreground and background subagents", async () => {
    const snapshot = makeSnapshot();
    const foreground = await resolveEffectiveConfiguration(
      snapshot,
      "backend",
      buildExecutionContext("foreground-subagent"),
    );
    const background = await resolveEffectiveConfiguration(
      snapshot,
      "backend",
      buildExecutionContext("background-subagent"),
    );

    expect(toolCapability(foreground, "Agent")?.status).toBe("available");
    expect(toolCapability(background, "Agent")?.status).toBe("denied");
    expect(toolCapability(foreground, "Read")?.status).toBe("available");
    expect(toolCapability(background, "Read")?.status).toBe("available");
    expect(toolCapability(background, "mcp__github__merge_pr")?.status).toBe("available");
  });

  it("does not apply agent configuration in fork context with unknown enforcement (T3)", async () => {
    const snapshot = makeSnapshot({
      agents: [
        makeAgent({
          configuration: {
            tools: ["Read", "Write", "Grep", "Bash", "Agent", "mcp__github__merge_pr"],
            disallowedTools: ["Bash"],
            permissionMode: "acceptEdits",
            unknownFields: {},
          },
        }),
      ],
    });

    const result = await resolveEffectiveConfiguration(
      snapshot,
      "backend",
      buildExecutionContext("fork", { parentPermissionMode: "auto" }),
    );

    expect(toolCapability(result, "Bash")?.status).toBe("available");
    expect(toolCapability(result, "Bash")?.enforcement).toBe("unknown");
    expect(toolCapability(result, "Bash")?.reasons[0]?.type).toBe("context-filter");
    expect(result.warnings.some((warning) => warning.category === "ignored-field")).toBe(true);
    expect(result.unknownRate).toBeGreaterThan(0);
  });

  it("resolves zero instruction sources with an I2 reason for explore and plan (I2)", async () => {
    const snapshot = makeSnapshot();

    const explore = await resolveEffectiveConfiguration(
      snapshot,
      "backend",
      buildExecutionContext("explore"),
    );
    const plan = await resolveEffectiveConfiguration(
      snapshot,
      "backend",
      buildExecutionContext("plan"),
    );

    // §4.4 item 4: one instruction capability carrying zero sources and the
    // I2 reason, not a silently empty capability list.
    for (const result of [explore, plan]) {
      const instructions = result.capabilities.filter(
        (capability) => capability.kind === "instruction",
      );
      expect(instructions).toHaveLength(1);
      expect(instructions[0]?.capabilityId).toBe("instructions");
      expect(instructions[0]?.status).toBe("denied");
      expect(instructions[0]?.sources).toHaveLength(0);
      expect(instructions[0]?.reasons[0]?.matrixRef).toBe(FACT.I2);
    }
    expect(toolCapability(explore, "Write")?.status).toBe("denied");
    expect(toolCapability(plan, "Edit")?.status).toBe("denied");
  });

  it("emits warnings for ineffective permissionMode and plugin fields", async () => {
    const pluginSource: SourceInfo = {
      platform: "claude",
      scope: "plugin",
      path: "plugins/review/agents/reviewer.md",
    };
    const pluginSnapshot = makeSnapshot({
      agents: [
        makeAgent({
          id: "reviewer",
          name: "reviewer",
          source: pluginSource,
          isPluginAgent: true,
          configuration: {
            tools: ["Read"],
            permissionMode: "acceptEdits",
            hooks: { form: "object", events: ["PreToolUse"], count: 1 },
            mcpServers: ["github"],
            unknownFields: {},
          },
        }),
      ],
    });

    const result = await resolveEffectiveConfiguration(
      pluginSnapshot,
      "reviewer",
      buildExecutionContext("foreground-subagent", { parentPermissionMode: "auto" }),
    );

    expect(result.warnings.filter((warning) => warning.category === "ignored-field").length).toBeGreaterThanOrEqual(2);
    expect(result.warnings.some((warning) => warning.matrixRef === "F9")).toBe(true);
  });

  it("emits Bash guardrail warning when restrictions coexist with Bash access", async () => {
    const snapshot = makeSnapshot({
      agents: [
        makeAgent({
          configuration: {
            tools: ["Read", "Bash"],
            disallowedTools: ["Write"],
            unknownFields: {},
          },
        }),
      ],
    });

    const result = await resolveEffectiveConfiguration(
      snapshot,
      "backend",
      buildExecutionContext("foreground-subagent"),
    );

    expect(result.warnings.some((warning) => warning.category === "security-finding")).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.message.includes("Tool-level restrictions are a guardrail"),
      ),
    ).toBe(true);
  });

  it("emits bypassPermissions security finding when declared on agent", async () => {
    const snapshot = makeSnapshot({
      agents: [
        makeAgent({
          configuration: {
            permissionMode: "bypassPermissions",
            unknownFields: {},
          },
        }),
      ],
    });

    const result = await resolveEffectiveConfiguration(
      snapshot,
      "backend",
      buildExecutionContext("foreground-subagent"),
    );

    expect(
      result.warnings.some(
        (warning) =>
          warning.category === "security-finding" &&
          warning.message.includes("bypassPermissions"),
      ),
    ).toBe(true);
  });

  it("emits inline MCP command security finding", async () => {
    const snapshot = makeSnapshot({
      agents: [
        makeAgent({
          configuration: {
            tools: ["Read"],
            mcpServers: [{ transport: "stdio", commandName: "node", envKeys: [], headerKeys: [] }],
            unknownFields: {},
          },
        }),
      ],
    });

    const result = await resolveEffectiveConfiguration(
      snapshot,
      "backend",
      buildExecutionContext("foreground-subagent"),
    );

    expect(
      result.warnings.some(
        (warning) =>
          warning.category === "security-finding" &&
          warning.message.includes("arbitrary command"),
      ),
    ).toBe(true);
  });

  it("blocks inline MCP and hooks when project trust is missing", async () => {
    const snapshot = makeSnapshot({
      agents: [
        makeAgent({
          configuration: {
            tools: ["Read"],
            mcpServers: [{ transport: "stdio", commandName: "node", envKeys: [], headerKeys: [] }],
            hooks: { form: "object", events: ["PreToolUse"], count: 1 },
            unknownFields: {},
          },
        }),
      ],
    });

    const result = await resolveEffectiveConfiguration(
      snapshot,
      "backend",
      buildExecutionContext("foreground-subagent"),
    );

    const inlineMcp = result.capabilities.find((capability) => capability.capabilityId === "inline-mcp:0");
    const hooks = result.capabilities.find((capability) => capability.capabilityId === "agent-hooks");

    expect(inlineMcp?.status).toBe("blocked");
    expect(hooks?.status).toBe("blocked");
    expect(inlineMcp?.reasons[0]?.matrixRef).toBe("R1");
    expect(hooks?.reasons[0]?.matrixRef).toBe("R5");
  });

  it("resolves inline MCP and hooks as unknown when the trust record is undetermined", async () => {
    const snapshot = makeSnapshot({
      trust: {
        accepted: "unknown",
        projectPath: "/workspace/project",
        unknownReason: "Could not read /home/user/.claude.json: EACCES.",
      },
      agents: [
        makeAgent({
          configuration: {
            tools: ["Read"],
            mcpServers: [{ transport: "stdio", commandName: "node", envKeys: [], headerKeys: [] }],
            hooks: { form: "object", events: ["PreToolUse"], count: 1 },
            unknownFields: {},
          },
        }),
      ],
    });

    const result = await resolveEffectiveConfiguration(
      snapshot,
      "backend",
      buildExecutionContext("foreground-subagent"),
    );

    const inlineMcp = result.capabilities.find((capability) => capability.capabilityId === "inline-mcp:0");
    const hooks = result.capabilities.find((capability) => capability.capabilityId === "agent-hooks");

    expect(inlineMcp).toMatchObject({ status: "unknown", enforcement: "unknown" });
    expect(hooks).toMatchObject({ status: "unknown", enforcement: "unknown" });
    expect(
      result.capabilities.some((capability) => capability.status === "blocked"),
    ).toBe(false);
    expect(result.unknownRate).toBeGreaterThan(0);
  });

  it("never blocks .mcp.json servers when the trust record is undetermined (M1 #7)", async () => {
    const snapshot = makeSnapshot({
      trust: { accepted: "unknown", projectPath: "/workspace/project" },
    });

    const result = await resolveEffectiveConfiguration(
      snapshot,
      "backend",
      buildExecutionContext("foreground-subagent"),
    );

    const mcpServer = result.capabilities.find((capability) =>
      capability.capabilityId.startsWith("mcp-server:"),
    );

    expect(mcpServer).toMatchObject({ status: "available", enforcement: "enforced" });
  });

  it("does not block MCP servers discovered from .mcp.json", async () => {
    const result = await resolveEffectiveConfiguration(
      makeSnapshot(),
      "backend",
      buildExecutionContext("foreground-subagent"),
    );

    const mcpServer = result.capabilities.find((capability) =>
      capability.capabilityId.startsWith("mcp-server:"),
    );

    expect(mcpServer?.status).toBe("available");
    expect(mcpServer?.reasons[0]?.matrixRef).toBe("R4");
  });

  it("reads disableBypassPermissionsMode from settings layers (P4)", async () => {
    const settingsLayer = await makeSettingsLayer({
      permissions: { disableBypassPermissionsMode: true },
    });
    const snapshot = makeSnapshot({
      settings: [settingsLayer],
      agents: [
        makeAgent({
          configuration: {
            permissionMode: "bypassPermissions",
            unknownFields: {},
          },
        }),
      ],
    });

    const result = await resolveEffectiveConfiguration(
      snapshot,
      "backend",
      buildExecutionContext("foreground-subagent"),
    );

    const permission = result.capabilities.find((capability) => capability.kind === "permission");
    expect(permission?.capabilityId).toBe("permission:default");
    expect(result.warnings.some((warning) => warning.category === "ignored-field")).toBe(true);
  });

  it("degrades every version-sensitive capability to unknown without a CLI version (§8.3)", async () => {
    const snapshot = makeSnapshot({
      version: {
        platform: "claude",
        version: "unknown",
        raw: "",
        detectedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    const result = await resolveEffectiveConfiguration(
      snapshot,
      "backend",
      buildExecutionContext("background-subagent"),
    );

    assertCapabilityContract(result.capabilities);
    expect(result.capabilities.length).toBeGreaterThan(0);
    for (const capability of result.capabilities) {
      expect(capability.enforcement).toBe("unknown");
      expect(
        capability.reasons.some((reason) => reason.type === "version"),
        `${capability.capabilityId} needs a version-typed reason`,
      ).toBe(true);
    }
    expect(result.unknownRate).toBe(1);
  });

  it("keeps enforcement enforced when the CLI version is detected", async () => {
    const result = await resolveEffectiveConfiguration(
      makeSnapshot(),
      "backend",
      buildExecutionContext("background-subagent"),
    );

    expect(toolCapability(result, "Read")?.enforcement).toBe("enforced");
    expect(
      result.capabilities.every(
        (capability) => !capability.reasons.some((reason) => reason.type === "version"),
      ),
    ).toBe(true);
  });

  it("leaves a rule below its matrix minVersion unknown (P4 needs 2.1.223)", async () => {
    const settings = await makeSettingsLayer({
      permissions: { disableBypassPermissionsMode: true },
    });
    const agents = [
      makeAgent({
        configuration: {
          tools: ["Read"],
          permissionMode: "bypassPermissions",
          unknownFields: {},
        },
      }),
    ];
    const context = buildExecutionContext("foreground-subagent");

    const old = await resolveEffectiveConfiguration(
      makeSnapshot({ agents, settings: [settings] }),
      "backend",
      context,
    );
    const current = await resolveEffectiveConfiguration(
      makeSnapshot({
        agents,
        settings: [settings],
        version: {
          platform: "claude",
          version: "2.1.223",
          raw: "2.1.223",
          detectedAt: "2026-01-01T00:00:00.000Z",
        },
      }),
      "backend",
      context,
    );

    const permissionOf = (
      result: Awaited<ReturnType<typeof resolveEffectiveConfiguration>>,
    ) => result.capabilities.find((capability) => capability.kind === "permission");

    expect(permissionOf(old)?.enforcement).toBe("unknown");
    expect(
      permissionOf(old)?.reasons.some((reason) => reason.type === "version"),
    ).toBe(true);
    expect(permissionOf(current)?.enforcement).toBe("enforced");
  });

  it("computes unknownRate from capabilities with unknown status or enforcement", async () => {
    const fork = await resolveEffectiveConfiguration(
      makeSnapshot(),
      "backend",
      buildExecutionContext("fork"),
    );
    const foreground = await resolveEffectiveConfiguration(
      makeSnapshot(),
      "backend",
      buildExecutionContext("foreground-subagent"),
    );

    expect(fork.unknownRate).toBeGreaterThan(foreground.unknownRate);
    expect(fork.unknownRate).toBeGreaterThan(0);
    expect(foreground.unknownRate).toBe(0);
  });
});

describe("application resolve wrapper", () => {
  it("delegates to resolveEffectiveConfiguration", async () => {
    const snapshot = makeSnapshot();
    const context = buildExecutionContext("main-session");

    const direct = await resolveEffectiveConfiguration(snapshot, "backend", context);
    const wrapped = await resolve({ snapshot, agentId: "backend", context });

    expect(wrapped).toEqual(direct);
  });
});
