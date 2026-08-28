import { describe, expect, it } from "vitest";
import {
  parseToolPattern,
  resolveAgentTools,
} from "../../../../src/adapters/claude/resolution/tools.js";
import type { SourceInfo } from "../../../../src/core/model/index.js";

const AGENT_SOURCE: SourceInfo = {
  platform: "claude",
  scope: "project",
  path: ".claude/agents/backend.md",
};

const PARENT_POOL = [
  "Read",
  "Write",
  "Grep",
  "Bash",
  "Agent",
  "Task",
  "mcp__github__create_issue",
  "mcp__github__merge_pr",
  "mcp__figma__get_file",
] as const;

function capability(id: string, result: ReturnType<typeof resolveAgentTools>) {
  return result.capabilities.find((c) => c.capabilityId === id);
}

describe("parseToolPattern", () => {
  it("parses exact builtin patterns", () => {
    expect(parseToolPattern("Read")).toEqual({ kind: "exact", value: "Read" });
  });

  it("parses MCP server patterns (F3)", () => {
    expect(parseToolPattern("mcp__github")).toEqual({
      kind: "mcp-server",
      server: "github",
    });
    expect(parseToolPattern("mcp__github__*")).toEqual({
      kind: "mcp-server-wildcard",
      server: "github",
    });
    expect(parseToolPattern("mcp__github__create_issue")).toEqual({
      kind: "exact",
      value: "mcp__github__create_issue",
    });
  });

  it("allows mcp__* only for disallowedTools (F3)", () => {
    expect(parseToolPattern("mcp__*", { allowMcpAll: true })).toEqual({
      kind: "mcp-all",
    });
    expect(parseToolPattern("mcp__*", { allowMcpAll: false })).toEqual({
      kind: "unknown",
      raw: "mcp__*",
    });
  });

  it("marks invalid parenthesis syntax as unknown (S3)", () => {
    expect(parseToolPattern("mcp__github(create)")).toEqual({
      kind: "unknown",
      raw: "mcp__github(create)",
    });
    expect(parseToolPattern("Bash(git diff:*)")).toEqual({
      kind: "unknown",
      raw: "Bash(git diff:*)",
    });
  });

  it("parses Agent(type1, type2) as an Agent entry, not as unparseable (F5)", () => {
    expect(parseToolPattern("Agent(reviewer, planner)")).toEqual({
      kind: "agent-types",
      types: ["reviewer", "planner"],
    });
    expect(parseToolPattern("Task(reviewer)")).toEqual({
      kind: "agent-types",
      types: ["reviewer"],
    });
    expect(parseToolPattern("Agent()")).toEqual({
      kind: "unknown",
      raw: "Agent()",
    });
  });
});

describe("resolveAgentTools", () => {
  it("inherits parent pool when no tools whitelist is declared", () => {
    const result = resolveAgentTools({
      parentPool: [...PARENT_POOL],
      version: "2.1.233",
      disallowedTools: ["Bash"],
      agentSource: AGENT_SOURCE,
    });

    expect(result.pool).not.toContain("Bash");
    expect(result.pool).toContain("Read");
    expect(capability("Bash", result)?.status).toBe("denied");
    expect(capability("Read", result)?.status).toBe("available");
    expect(capability("Read", result)?.reasons[0]?.type).toBe("inherited");
  });

  it("applies disallowedTools before tools whitelist (F2)", () => {
    const result = resolveAgentTools({
      parentPool: [...PARENT_POOL],
      version: "2.1.233",
      tools: ["Read", "Write", "Grep", "Bash"],
      disallowedTools: ["Bash", "mcp__github__merge_pr"],
      agentSource: AGENT_SOURCE,
    });

    expect(result.pool).toEqual(["Read", "Write", "Grep"]);
    expect(capability("Bash", result)?.status).toBe("denied");
    expect(capability("mcp__github__merge_pr", result)?.status).toBe("denied");
    expect(capability("mcp__github__create_issue", result)?.status).toBe("denied");
  });

  it("supports MCP server and wildcard patterns (F3)", () => {
    const result = resolveAgentTools({
      parentPool: [...PARENT_POOL],
      version: "2.1.233",
      tools: ["mcp__github", "Read"],
      agentSource: AGENT_SOURCE,
    });

    expect(result.pool).toContain("mcp__github__create_issue");
    expect(result.pool).toContain("mcp__github__merge_pr");
    expect(result.pool).not.toContain("mcp__figma__get_file");
    expect(result.pool).toContain("Read");
  });

  it("denies all MCP tools with mcp__* in disallowedTools (F3)", () => {
    const result = resolveAgentTools({
      parentPool: [...PARENT_POOL],
      version: "2.1.233",
      disallowedTools: ["mcp__*"],
      agentSource: AGENT_SOURCE,
    });

    expect(result.pool).not.toContain("mcp__github__create_issue");
    expect(result.pool).not.toContain("mcp__figma__get_file");
    expect(result.pool).toContain("Read");
  });

  it("removes tools declared in both lists (F2)", () => {
    const result = resolveAgentTools({
      parentPool: [...PARENT_POOL],
      version: "2.1.233",
      tools: ["Read", "Write"],
      disallowedTools: ["Read"],
      agentSource: AGENT_SOURCE,
    });

    expect(result.pool).not.toContain("Read");
    expect(result.pool).toContain("Write");
    expect(capability("Read", result)?.status).toBe("denied");
    expect(capability("Read", result)?.reasons[0]?.message).toContain("both tools and disallowedTools");
  });

  it("treats Agent and Task as aliases (F11)", () => {
    const denied = resolveAgentTools({
      parentPool: ["Agent", "Task", "Read"],
      version: "2.1.233",
      disallowedTools: ["Agent"],
      agentSource: AGENT_SOURCE,
    });
    expect(denied.pool).toEqual(["Read"]);
    expect(capability("Task", denied)?.status).toBe("denied");

    const allowed = resolveAgentTools({
      parentPool: ["Agent", "Task", "Read"],
      version: "2.1.233",
      tools: ["Task"],
      agentSource: AGENT_SOURCE,
    });
    expect(allowed.pool).toEqual(["Agent", "Task"]);
  });

  it("emits unknown status for unrecognized patterns without confident deny", () => {
    const result = resolveAgentTools({
      parentPool: ["Read", "Write"],
      version: "2.1.233",
      disallowedTools: ["mcp__github(bad)"],
      tools: ["mcp__*"],
      agentSource: AGENT_SOURCE,
    });

    // Nothing in `tools` parsed, so no tool may be reported available.
    expect(result.pool).toEqual([]);
    expect(
      result.capabilities.filter((c) => c.status === "available"),
    ).toHaveLength(0);
    for (const toolName of ["Read", "Write"]) {
      expect(capability(toolName, result)?.status).toBe("unknown");
      expect(capability(toolName, result)?.enforcement).toBe("unknown");
    }
    const patternUnknowns = result.capabilities.filter(
      (c) => c.capabilityId === "mcp__*" || c.capabilityId === "mcp__github(bad)",
    );
    expect(patternUnknowns.map((c) => c.capabilityId).sort()).toEqual([
      "mcp__*",
      "mcp__github(bad)",
    ]);
    expect(patternUnknowns.every((c) => c.status === "unknown")).toBe(true);
  });

  it("never reports a tool available when the tools whitelist is unparseable", () => {
    const result = resolveAgentTools({
      parentPool: [...PARENT_POOL],
      version: "2.1.233",
      tools: ["Bash(git diff:*)"],
      agentSource: AGENT_SOURCE,
    });

    expect(result.pool).toEqual([]);
    expect(
      result.capabilities.filter((c) => c.status === "available"),
    ).toHaveLength(0);
    for (const toolName of PARENT_POOL) {
      const cap = capability(toolName, result);
      expect(cap?.status).toBe("unknown");
      expect(cap?.enforcement).toBe("unknown");
      expect(cap?.reasons[0]?.message).toContain("Bash(git diff:*)");
      expect(cap?.sources.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps parsed patterns effective while an unparsed one downgrades only what it could match", () => {
    const result = resolveAgentTools({
      parentPool: ["Read", "Write", "Bash"],
      version: "2.1.233",
      tools: ["Read", "Bash(git diff:*)"],
      agentSource: AGENT_SOURCE,
    });

    expect(result.pool).toEqual(["Read"]);
    expect(capability("Read", result)?.status).toBe("available");
    // Only `Bash` could have been meant by `Bash(git diff:*)`.
    expect(capability("Bash", result)?.status).toBe("unknown");
    expect(capability("Bash", result)?.enforcement).toBe("unknown");
    expect(capability("Bash", result)?.reasons[0]?.message).toContain(
      "Bash(git diff:*)",
    );
    expect(capability("Write", result)?.status).toBe("denied");
  });

  it("downgrades tools an unparseable disallowedTools pattern could remove", () => {
    const result = resolveAgentTools({
      parentPool: ["Read", "Write", "Bash"],
      version: "2.1.233",
      disallowedTools: ["Bash(rm:*)"],
      agentSource: AGENT_SOURCE,
    });

    expect(result.pool).toEqual(["Read", "Write"]);
    expect(capability("Bash", result)?.status).toBe("unknown");
    expect(capability("Bash", result)?.enforcement).toBe("unknown");
    expect(capability("Bash", result)?.reasons[0]?.message).toContain("Bash(rm:*)");
  });

  it("treats Agent(type1, type2) as the Agent tool inside a subagent definition (F5)", () => {
    const result = resolveAgentTools({
      parentPool: ["Agent", "Task", "Read"],
      version: "2.1.233",
      tools: ["Agent(reviewer, planner)"],
      agentSource: AGENT_SOURCE,
    });

    expect(result.pool).toEqual(["Agent", "Task"]);
    expect(capability("Agent", result)?.status).toBe("available");
    expect(capability("Task", result)?.status).toBe("available");
    expect(capability("Read", result)?.status).toBe("denied");
    expect(
      result.capabilities.some((c) => c.capabilityId === "Agent(reviewer, planner)"),
    ).toBe(false);
  });

  it("denies every tool when tools is declared empty (F2, F4)", () => {
    const result = resolveAgentTools({
      parentPool: ["Read", "Write"],
      version: "2.1.233",
      tools: [],
      agentSource: AGENT_SOURCE,
    });

    expect(result.pool).toEqual([]);
    expect(capability("Read", result)?.status).toBe("denied");
  });

  it("returns empty pool when tools whitelist resolves to nothing (F4)", () => {
    const result = resolveAgentTools({
      parentPool: ["Read", "Write"],
      version: "2.1.233",
      tools: ["NonExistentBuiltin"],
      agentSource: AGENT_SOURCE,
    });

    expect(result.pool).toEqual([]);
    expect(capability("Read", result)?.status).toBe("denied");
  });

  it("requires every capability to have sources and reasons", () => {
    const result = resolveAgentTools({
      parentPool: [...PARENT_POOL],
      version: "2.1.233",
      tools: ["Read"],
      disallowedTools: ["Bash"],
      agentSource: AGENT_SOURCE,
    });

    for (const cap of result.capabilities) {
      expect(cap.sources.length).toBeGreaterThanOrEqual(1);
      expect(cap.reasons.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("preserves deterministic parent pool ordering", () => {
    const result = resolveAgentTools({
      parentPool: ["Write", "Read", "Grep"],
      version: "2.1.233",
      tools: ["Read", "Grep", "Write"],
      agentSource: AGENT_SOURCE,
    });

    expect(result.pool).toEqual(["Write", "Read", "Grep"]);
  });

  it("degrades status and enforcement to unknown when no CLI version was detected (§8.3)", () => {
    const result = resolveAgentTools({
      parentPool: [...PARENT_POOL],
      version: "unknown",
      tools: ["Read"],
      disallowedTools: ["Bash"],
      agentSource: AGENT_SOURCE,
    });

    for (const id of ["Read", "Bash", "Write"]) {
      expect(capability(id, result)?.enforcement, id).toBe("unknown");
      expect(
        capability(id, result)?.reasons.some((reason) => reason.type === "version"),
        id,
      ).toBe(true);
    }
    // Which filter ran is platform behaviour, not file content: without a
    // version the status is unfounded, not merely unguaranteed (H1-17).
    expect(capability("Read", result)?.status).toBe("unknown");
    expect(capability("Bash", result)?.status).toBe("unknown");
  });
});
