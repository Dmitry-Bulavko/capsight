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
  });
});

describe("resolveAgentTools", () => {
  it("inherits parent pool when no tools whitelist is declared", () => {
    const result = resolveAgentTools({
      parentPool: [...PARENT_POOL],
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
      disallowedTools: ["Agent"],
      agentSource: AGENT_SOURCE,
    });
    expect(denied.pool).toEqual(["Read"]);
    expect(capability("Task", denied)?.status).toBe("denied");

    const allowed = resolveAgentTools({
      parentPool: ["Agent", "Task", "Read"],
      tools: ["Task"],
      agentSource: AGENT_SOURCE,
    });
    expect(allowed.pool).toEqual(["Agent", "Task"]);
  });

  it("emits unknown status for unrecognized patterns without confident deny", () => {
    const result = resolveAgentTools({
      parentPool: ["Read", "Write"],
      disallowedTools: ["mcp__github(bad)"],
      tools: ["mcp__*"],
      agentSource: AGENT_SOURCE,
    });

    expect(result.pool).toEqual(["Read", "Write"]);
    const unknowns = result.capabilities.filter((c) => c.status === "unknown");
    expect(unknowns).toHaveLength(2);
    expect(unknowns.map((c) => c.capabilityId).sort()).toEqual([
      "mcp__*",
      "mcp__github(bad)",
    ]);
  });

  it("returns empty pool when tools whitelist resolves to nothing (F4)", () => {
    const result = resolveAgentTools({
      parentPool: ["Read", "Write"],
      tools: ["NonExistentBuiltin"],
      agentSource: AGENT_SOURCE,
    });

    expect(result.pool).toEqual([]);
    expect(capability("Read", result)?.status).toBe("denied");
  });

  it("requires every capability to have sources and reasons", () => {
    const result = resolveAgentTools({
      parentPool: [...PARENT_POOL],
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
      tools: ["Read", "Grep", "Write"],
      agentSource: AGENT_SOURCE,
    });

    expect(result.pool).toEqual(["Write", "Read", "Grep"]);
  });
});
