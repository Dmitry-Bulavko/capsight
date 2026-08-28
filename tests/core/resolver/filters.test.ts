import { describe, expect, it } from "vitest";
import { applyContextFilters } from "../../../src/core/resolver/filters.js";
import { buildExecutionContext } from "../../../src/core/resolver/context.js";

const SAMPLE_TOOLS = [
  "Read",
  "Write",
  "Agent",
  "AskUserQuestion",
  "EnterPlanMode",
  "ExitPlanMode",
  "Workflow",
  "Bash",
  "mcp__github__create_issue",
  "mcp__github__merge_pr",
  "UnknownBuiltin",
] as const;

describe("applyContextFilters", () => {
  it("main session passes tools through unchanged", () => {
    const ctx = buildExecutionContext("main-session");
    const result = applyContextFilters([...SAMPLE_TOOLS], ctx);

    expect(result.tools).toEqual([...SAMPLE_TOOLS]);
    expect(result.removals).toEqual([]);
    expect(result.forkSkip).toBeUndefined();
  });

  it("foreground subagent applies Filter 1 (T1)", () => {
    const ctx = buildExecutionContext("foreground-subagent");
    const result = applyContextFilters([...SAMPLE_TOOLS], ctx);

    expect(result.tools).not.toContain("AskUserQuestion");
    expect(result.tools).not.toContain("EnterPlanMode");
    expect(result.tools).not.toContain("ExitPlanMode");
    expect(result.tools).not.toContain("Workflow");
    expect(result.tools).toContain("Read");
    expect(result.tools).toContain("Write");
    expect(result.tools).toContain("Agent");
    expect(result.tools).toContain("UnknownBuiltin");

    expect(
      result.removals.filter((r) => r.reason.type === "context-filter").length,
    ).toBeGreaterThan(0);
  });

  it("plan preset keeps ExitPlanMode per T1 exception", () => {
    const ctx = buildExecutionContext("plan");
    const result = applyContextFilters(
      ["Read", "ExitPlanMode", "EnterPlanMode"],
      ctx,
    );

    expect(result.tools).toContain("ExitPlanMode");
    expect(result.tools).not.toContain("EnterPlanMode");
  });

  it("background subagent applies Filter 2 (T2) after Filter 1", () => {
    const ctx = buildExecutionContext("background-subagent");
    const result = applyContextFilters([...SAMPLE_TOOLS], ctx);

    expect(result.tools).toContain("Read");
    expect(result.tools).toContain("Write");
    expect(result.tools).toContain("Bash");
    expect(result.tools).toContain("mcp__github__create_issue");
    expect(result.tools).toContain("mcp__github__merge_pr");
    expect(result.tools).not.toContain("Agent");
    expect(result.tools).not.toContain("AskUserQuestion");
    expect(result.tools).not.toContain("UnknownBuiltin");
  });

  it("fork returns empty delta with context-filter skip reason (T3)", () => {
    const ctx = buildExecutionContext("fork");
    const result = applyContextFilters([...SAMPLE_TOOLS], ctx);

    expect(result.tools).toEqual([...SAMPLE_TOOLS]);
    expect(result.removals).toEqual([]);
    expect(result.forkSkip?.type).toBe("context-filter");
  });

  it("fork at depth limit keeps Agent in list (N2)", () => {
    const ctx = buildExecutionContext("fork", { depth: 3, maxDepth: 3 });
    const result = applyContextFilters(["Read", "Agent"], ctx);

    expect(result.tools).toContain("Agent");
    expect(result.removals).toEqual([]);
    expect(result.forkSkip?.type).toBe("context-filter");
  });

  it("depth >= maxDepth removes Agent with depth-limit reason (N2)", () => {
    const ctx = buildExecutionContext("foreground-subagent", {
      depth: 3,
      maxDepth: 3,
    });
    const result = applyContextFilters(["Read", "Agent", "Task"], ctx);

    expect(result.tools).not.toContain("Agent");
    expect(result.tools).not.toContain("Task");
    expect(result.tools).toContain("Read");

    const agentRemovals = result.removals.filter((r) =>
      ["Agent", "Task"].includes(r.tool),
    );
    expect(agentRemovals).toHaveLength(2);
    expect(agentRemovals.every((r) => r.reason.type === "depth-limit")).toBe(
      true,
    );
  });

  it("explore preset applies Filter 1 as foreground subagent", () => {
    const ctx = buildExecutionContext("explore");
    const result = applyContextFilters(
      ["Read", "AskUserQuestion", "Agent"],
      ctx,
    );

    expect(result.tools).toEqual(["Read", "Agent"]);
    expect(result.removals.map((r) => r.tool)).toEqual(["AskUserQuestion"]);
  });

  it("preserves deterministic input ordering", () => {
    const tools = ["Write", "Read", "Grep", "mcp__x__y"];
    const ctx = buildExecutionContext("background-subagent");
    const result = applyContextFilters(tools, ctx);

    expect(result.tools).toEqual(["Write", "Read", "Grep", "mcp__x__y"]);
  });
});
