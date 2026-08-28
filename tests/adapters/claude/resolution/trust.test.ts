import { describe, expect, it } from "vitest";
import {
  isInlineMcpServerEntry,
  isMcpConfigFileSource,
  isTrustGatedAgent,
  resolveMcpConfigFileTrust,
  resolveTrustGate,
} from "../../../../src/adapters/claude/resolution/trust.js";
import { resolvePluginFieldLimitations } from "../../../../src/adapters/claude/resolution/plugin.js";
import type { Agent, SourceInfo, TrustState } from "../../../../src/core/model/index.js";

const PROJECT_AGENT_SOURCE: SourceInfo = {
  platform: "claude",
  scope: "project",
  path: ".claude/agents/backend.md",
};

const USER_AGENT_SOURCE: SourceInfo = {
  platform: "claude",
  scope: "user",
  path: "/home/user/.claude/agents/reviewer.md",
};

const MCP_CONFIG_SOURCE: SourceInfo = {
  platform: "claude",
  scope: "project",
  path: ".mcp.json",
};

const TRUST_DENIED: TrustState = {
  accepted: false,
  projectPath: "/workspace/project",
};

const TRUST_ACCEPTED: TrustState = {
  accepted: true,
  projectPath: "/workspace/project",
};

function makeAgent(
  source: SourceInfo,
  configuration: Agent["configuration"] = { unknownFields: {} },
  isPluginAgent = false,
): Agent {
  return {
    id: "agent-1",
    name: "backend",
    description: "Backend agent",
    source,
    status: "active",
    configuration,
    isPluginAgent,
  };
}

describe("isInlineMcpServerEntry", () => {
  it("treats object entries as inline definitions", () => {
    expect(isInlineMcpServerEntry({ transport: "stdio", commandName: "node", envKeys: [], headerKeys: [] })).toBe(
      true,
    );
  });

  it("treats string entries as named references", () => {
    expect(isInlineMcpServerEntry("github")).toBe(false);
  });
});

describe("isMcpConfigFileSource", () => {
  it("detects .mcp.json configuration sources", () => {
    expect(isMcpConfigFileSource(MCP_CONFIG_SOURCE)).toBe(true);
    expect(
      isMcpConfigFileSource({
        platform: "claude",
        scope: "nested-project",
        path: "packages/api/.mcp.json",
      }),
    ).toBe(true);
  });

  it("returns false for agent frontmatter sources", () => {
    expect(isMcpConfigFileSource(PROJECT_AGENT_SOURCE)).toBe(false);
  });
});

describe("isTrustGatedAgent", () => {
  it("gates project and nested-project agents", () => {
    expect(isTrustGatedAgent(makeAgent(PROJECT_AGENT_SOURCE))).toBe(true);
    expect(
      isTrustGatedAgent(
        makeAgent({
          platform: "claude",
          scope: "nested-project",
          path: "packages/api/.claude/agents/nested.md",
        }),
      ),
    ).toBe(true);
  });

  it("does not gate user, cli, managed, or plugin agents (R4)", () => {
    expect(isTrustGatedAgent(makeAgent(USER_AGENT_SOURCE))).toBe(false);
    expect(
      isTrustGatedAgent(
        makeAgent({ platform: "claude", scope: "cli", path: "--agents" }),
      ),
    ).toBe(false);
    expect(
      isTrustGatedAgent(
        makeAgent({ platform: "claude", scope: "managed", path: "/etc/claude" }),
      ),
    ).toBe(false);
    expect(
      isTrustGatedAgent(
        makeAgent(
          { platform: "claude", scope: "plugin", path: "plugin/agents/review.md" },
          { unknownFields: {} },
          true,
        ),
      ),
    ).toBe(false);
  });
});

describe("resolveTrustGate", () => {
  it("blocks project inline MCP when trust is not accepted (R1)", () => {
    const agent = makeAgent(PROJECT_AGENT_SOURCE, {
      mcpServers: [{ transport: "stdio", commandName: "node", envKeys: [], headerKeys: [] }],
      unknownFields: {},
    });

    const result = resolveTrustGate({
      agent,
      trust: TRUST_DENIED,
      kind: "inline-mcp",
      mcpServerEntry: agent.configuration.mcpServers![0],
      mcpServerIndex: 0,
    });

    expect(result).toMatchObject({
      status: "blocked_by_trust",
      gated: true,
    });
    expect(result.reasons[0]?.type).toBe("trust");
    expect(result.reasons[0]?.matrixRef).toBe("R1");
  });

  it("allows project inline MCP when trust is accepted (R1)", () => {
    const agent = makeAgent(PROJECT_AGENT_SOURCE, {
      mcpServers: [{ transport: "stdio", commandName: "node", envKeys: [], headerKeys: [] }],
      unknownFields: {},
    });

    const result = resolveTrustGate({
      agent,
      trust: TRUST_ACCEPTED,
      kind: "inline-mcp",
      mcpServerEntry: agent.configuration.mcpServers![0],
      mcpServerIndex: 0,
    });

    expect(result).toMatchObject({
      status: "available",
      gated: true,
    });
    expect(result.reasons[0]?.matrixRef).toBe("R1");
  });

  it("does not gate named MCP references in project agents (R4)", () => {
    const agent = makeAgent(PROJECT_AGENT_SOURCE, {
      mcpServers: ["github"],
      unknownFields: {},
    });

    const result = resolveTrustGate({
      agent,
      trust: TRUST_DENIED,
      kind: "inline-mcp",
      mcpServerEntry: "github",
      mcpServerIndex: 0,
    });

    expect(result).toMatchObject({
      status: "available",
      gated: false,
    });
    expect(result.reasons[0]?.matrixRef).toBe("R4");
  });

  it("does not gate inline MCP from user-level agents (R4)", () => {
    const agent = makeAgent(USER_AGENT_SOURCE, {
      mcpServers: [{ transport: "stdio", commandName: "node", envKeys: [], headerKeys: [] }],
      unknownFields: {},
    });

    const result = resolveTrustGate({
      agent,
      trust: TRUST_DENIED,
      kind: "inline-mcp",
      mcpServerEntry: agent.configuration.mcpServers![0],
      mcpServerIndex: 0,
    });

    expect(result).toMatchObject({
      status: "available",
      gated: false,
    });
    expect(result.reasons[0]?.matrixRef).toBe("R4");
  });

  it("blocks project agent hooks when trust is not accepted (R5)", () => {
    const agent = makeAgent(PROJECT_AGENT_SOURCE, {
      hooks: { form: "object", events: ["PreToolUse"], count: 1 },
      unknownFields: {},
    });

    const result = resolveTrustGate({
      agent,
      trust: TRUST_DENIED,
      kind: "agent-hooks",
    });

    expect(result).toMatchObject({
      status: "blocked_by_trust",
      gated: true,
    });
    expect(result.reasons[0]?.matrixRef).toBe("R5");
  });

  it("allows user-level agent hooks without trust (R4)", () => {
    const agent = makeAgent(USER_AGENT_SOURCE, {
      hooks: { form: "object", events: ["PreToolUse"], count: 1 },
      unknownFields: {},
    });

    const result = resolveTrustGate({
      agent,
      trust: TRUST_DENIED,
      kind: "agent-hooks",
    });

    expect(result).toMatchObject({
      status: "available",
      gated: false,
    });
    expect(result.reasons[0]?.matrixRef).toBe("R4");
  });
});

describe("resolveMcpConfigFileTrust", () => {
  it("never blocks servers from .mcp.json", () => {
    const result = resolveMcpConfigFileTrust(MCP_CONFIG_SOURCE);

    expect(result).toMatchObject({
      status: "available",
      gated: false,
    });
    expect(result.reasons[0]?.matrixRef).toBe("R4");
  });
});

describe("resolvePluginFieldLimitations", () => {
  const pluginSource: SourceInfo = {
    platform: "claude",
    scope: "plugin",
    path: "plugins/my-plugin/agents/reviewer.md",
  };

  it("marks hooks, mcpServers, and permissionMode ineffective for plugin agents (F9)", () => {
    const agent = makeAgent(
      pluginSource,
      {
        hooks: { form: "object", events: ["PreToolUse"], count: 1 },
        mcpServers: ["github"],
        permissionMode: "acceptEdits",
        unknownFields: {},
      },
      true,
    );

    const results = resolvePluginFieldLimitations(agent);

    expect(results.map((entry) => entry.field).sort()).toEqual([
      "hooks",
      "mcpServers",
      "permissionMode",
    ]);
    for (const entry of results) {
      expect(entry).toMatchObject({
        ineffective: true,
        effective: undefined,
      });
      expect(entry.reasons[0]?.type).toBe("plugin-limitation");
      expect(entry.reasons[0]?.matrixRef).toBe("F9");
    }
  });

  it("returns no limitations for non-plugin agents", () => {
    const agent = makeAgent(PROJECT_AGENT_SOURCE, {
      hooks: { form: "object", events: ["PreToolUse"], count: 1 },
      mcpServers: ["github"],
      permissionMode: "acceptEdits",
      unknownFields: {},
    });

    expect(resolvePluginFieldLimitations(agent)).toEqual([]);
  });

  it("skips undeclared plugin fields", () => {
    const agent = makeAgent(
      pluginSource,
      {
        permissionMode: "auto",
        unknownFields: {},
      },
      true,
    );

    const results = resolvePluginFieldLimitations(agent);

    expect(results).toHaveLength(1);
    expect(results[0]?.field).toBe("permissionMode");
  });
});
