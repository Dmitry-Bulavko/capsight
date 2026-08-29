import { describe, expect, it } from "vitest";
import type {
  EffectiveConfiguration,
  ExecutionContext,
  PlatformVersion,
  ResolvedCapability,
} from "../../../src/core/model/index.js";
import type { ClaudeProjectSnapshot as ProjectSnapshot } from "../../../src/adapters/claude/model/index.js";
import {
  buildInspectionGraph,
  graphNodeIds,
} from "../../../src/core/graph/build-graph.js";
import { buildExecutionContext } from "../../../src/adapters/claude/resolution/context.js";
import { CLAUDE_TOOL_TABLES } from "../../../src/adapters/claude/resolution/tool-tables.js";

const mockVersion: PlatformVersion = {
  platform: "claude",
  version: "2.1.0",
  raw: "2.1.0",
  detectedAt: "2026-01-01T00:00:00.000Z",
};

const mainContext = buildExecutionContext("main-session");

function makeCapability(
  overrides: Partial<ResolvedCapability> & Pick<ResolvedCapability, "capabilityId" | "kind">,
): ResolvedCapability {
  return {
    status: "available",
    enforcement: "enforced",
    sources: [],
    reasons: [],
    ...overrides,
  };
}

function makeEffective(
  agentId: string,
  capabilities: ResolvedCapability[],
  context: ExecutionContext = mainContext,
): EffectiveConfiguration {
  return {
    agentId,
    context,
    version: mockVersion,
    capabilities,
    warnings: [],
    unknownRate: 0,
  };
}

function makeSnapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    id: "snapshot-graph",
    projectPath: "/mock/project",
    version: mockVersion,
    environment: { relevant: [] },
    trust: { accepted: false, projectPath: "/mock/project" },
    agents: [
      {
        id: "backend",
        name: "backend",
        description: "Backend agent",
        source: {
          platform: "claude",
          scope: "project",
          path: "/mock/project/.claude/agents/backend.md",
        },
        status: "active",
        configuration: {
          tools: ["Read", "Agent"],
          unknownFields: {},
        },
        isPluginAgent: false,
      },
      {
        id: "worker",
        name: "worker",
        description: "Worker agent",
        source: {
          platform: "claude",
          scope: "project",
          path: "/mock/project/.claude/agents/worker.md",
        },
        status: "active",
        configuration: {
          tools: ["Read"],
          unknownFields: {},
        },
        isPluginAgent: false,
      },
    ],
    skills: [],
    instructions: [],
    mcpServers: [],
    settings: [],
    warnings: [],
    scannedAt: "2026-01-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("buildInspectionGraph", () => {
  it("creates agent, tool, mcp, skill, and instruction nodes with expected edges", () => {
    const effectiveByAgent = new Map<string, EffectiveConfiguration>([
      [
        "backend",
        makeEffective("backend", [
          makeCapability({ capabilityId: "Read", kind: "tool" }),
          makeCapability({ capabilityId: "Agent", kind: "tool" }),
          makeCapability({ capabilityId: "mcp-server:figma", kind: "mcp_server" }),
          makeCapability({
            capabilityId: "mcp__figma__get_file",
            kind: "mcp_tool",
          }),
          makeCapability({ capabilityId: "commit-helper", kind: "skill" }),
          makeCapability({ capabilityId: "instruction:project", kind: "instruction" }),
        ]),
      ],
      ["worker", makeEffective("worker", [makeCapability({ capabilityId: "Read", kind: "tool" })])],
    ]);

    const graph = buildInspectionGraph({
      snapshot: makeSnapshot(),
      context: mainContext,
      effectiveByAgent,
      toolTables: CLAUDE_TOOL_TABLES,
    });

    const nodeKinds = new Set(graph.nodes.map((node) => node.kind));
    expect(nodeKinds).toEqual(
      new Set(["agent", "tool", "mcp_server", "mcp_tool", "skill", "instruction"]),
    );

    const edgeKinds = new Set(graph.edges.map((edge) => edge.kind));
    expect(edgeKinds).toEqual(
      new Set([
        "agent-tool",
        "agent-mcp-server",
        "mcp-server-mcp-tool",
        "agent-skill",
        "agent-instruction",
        "agent-agent",
      ]),
    );

    expect(graph.edges).toContainEqual({
      id: `${graphNodeIds.agent("backend")}->${graphNodeIds.tool("Read")}`,
      source: graphNodeIds.agent("backend"),
      target: graphNodeIds.tool("Read"),
      kind: "agent-tool",
    });

    expect(graph.edges).toContainEqual({
      id: `${graphNodeIds.mcpServer("figma")}->${graphNodeIds.mcpTool("mcp__figma__get_file")}`,
      source: graphNodeIds.mcpServer("figma"),
      target: graphNodeIds.mcpTool("mcp__figma__get_file"),
      kind: "mcp-server-mcp-tool",
    });

    expect(graph.edges).toContainEqual({
      id: `${graphNodeIds.agent("backend")}->${graphNodeIds.agent("worker")}:spawn`,
      source: graphNodeIds.agent("backend"),
      target: graphNodeIds.agent("worker"),
      kind: "agent-agent",
    });
  });

  it("omits denied capabilities from the graph", () => {
    const effectiveByAgent = new Map<string, EffectiveConfiguration>([
      [
        "backend",
        makeEffective("backend", [
          makeCapability({ capabilityId: "Read", kind: "tool", status: "denied" }),
          makeCapability({ capabilityId: "Write", kind: "tool" }),
        ]),
      ],
      ["worker", makeEffective("worker", [])],
    ]);

    const graph = buildInspectionGraph({
      snapshot: makeSnapshot({
        agents: makeSnapshot().agents.slice(0, 1),
      }),
      context: mainContext,
      effectiveByAgent,
      toolTables: CLAUDE_TOOL_TABLES,
    });

    expect(graph.nodes.some((node) => node.id === graphNodeIds.tool("Read"))).toBe(false);
    expect(graph.nodes.some((node) => node.id === graphNodeIds.tool("Write"))).toBe(true);
  });

  it("changes edges when effective configuration changes by context", () => {
    const foreground = buildExecutionContext("foreground-subagent");
    const fork = buildExecutionContext("fork");

    const foregroundEffective = makeEffective(
      "backend",
      [makeCapability({ capabilityId: "Read", kind: "tool" })],
      foreground,
    );
    const forkEffective = makeEffective(
      "backend",
      [makeCapability({ capabilityId: "Write", kind: "tool" })],
      fork,
    );

    const snapshot = makeSnapshot({
      agents: makeSnapshot().agents.slice(0, 1),
    });

    const foregroundGraph = buildInspectionGraph({
      snapshot,
      context: foreground,
      effectiveByAgent: new Map([["backend", foregroundEffective]]),
      toolTables: CLAUDE_TOOL_TABLES,
    });

    const forkGraph = buildInspectionGraph({
      snapshot,
      context: fork,
      effectiveByAgent: new Map([["backend", forkEffective]]),
      toolTables: CLAUDE_TOOL_TABLES,
    });

    expect(foregroundGraph.context.preset).toBe("foreground-subagent");
    expect(forkGraph.context.preset).toBe("fork");
    expect(foregroundGraph.edges).not.toEqual(forkGraph.edges);
  });
});
