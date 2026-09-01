import type { ExecutionContext, ResolutionReason } from "../model/index.js";
import { makeReason } from "./reasons.js";
import type { PlatformToolTables } from "./tool-tables.js";

export interface ContextFilterRemoval {
  tool: string;
  reason: ResolutionReason;
}

export interface ContextFilterResult {
  /** Tools remaining after context filters (input order preserved). */
  tools: string[];
  /** Tools removed by this pass, in deterministic removal order. */
  removals: ContextFilterRemoval[];
  /** Set when isFork — filters skipped; resolver uses parent pool (T3). */
  forkSkip?: ResolutionReason;
}

function isPlanMode(context: ExecutionContext, planKind: string): boolean {
  return context.preset === "plan" || context.builtinKind === planKind;
}

function shouldApplyFilter1(context: ExecutionContext): boolean {
  return !context.isMainSession && !context.isFork;
}

function shouldApplyFilter2(context: ExecutionContext): boolean {
  return context.isBackground && !context.isFork;
}

/**
 * Apply context filters T1/T2, fork skip (T3), and spawn-tool depth limit (N2).
 * All tool names come from `tables`; this engine contains none of its own.
 * @see docs/SPEC.md §4.4 rules 1–3
 */
export function applyContextFilters(
  tools: readonly string[],
  context: ExecutionContext,
  tables: PlatformToolTables,
): ContextFilterResult {
  if (context.isFork) {
    return {
      tools: [...tools],
      removals: [],
      forkSkip: makeReason(
        "context-filter",
        "Fork inherits parent session tool pool; agent configuration filters are not applied.",
      ),
    };
  }

  const agentTools = new Set(tables.agentToolNames);
  const filter1Removed = new Set(tables.filter1RemovedTools);
  const planExempt = new Set(tables.filter1PlanModeExemptTools);
  const filter2Allowed = new Set<string>([
    ...tables.filter2AllowedBuiltinTools,
    ...(context.isTeammate ? tables.filter2TeammateAdditionalTools : []),
  ]);

  const removals: ContextFilterRemoval[] = [];
  const removed = new Set<string>();

  const remove = (tool: string, reason: ResolutionReason): void => {
    if (!removed.has(tool)) {
      removed.add(tool);
      removals.push({ tool, reason });
    }
  };

  // §4.4 rule 2 / N2 — spawn tool unavailable at depth limit (fork handled above).
  if (context.depth >= context.maxDepth) {
    for (const tool of tools) {
      if (agentTools.has(tool)) {
        remove(
          tool,
          makeReason(
            "depth-limit",
            `Agent unavailable at subagent depth limit (${context.depth} >= ${context.maxDepth}).`,
          ),
        );
      }
    }
  }

  // §4.4 rule 3 (Filter 1 first) / T1 — all subagents.
  if (shouldApplyFilter1(context)) {
    const planMode = isPlanMode(context, tables.planModeBuiltinKind);
    for (const tool of tools) {
      if (removed.has(tool) || !filter1Removed.has(tool)) {
        continue;
      }
      if (planMode && planExempt.has(tool)) {
        continue;
      }
      remove(
        tool,
        makeReason("context-filter", "Tool removed by subagent filter 1 (T1)."),
      );
    }
  }

  // §4.4 rule 3 (Filter 2 after Filter 1) / T2 — background subagents.
  if (shouldApplyFilter2(context)) {
    for (const tool of tools) {
      if (
        removed.has(tool) ||
        tables.isNamespacedTool(tool) ||
        filter2Allowed.has(tool)
      ) {
        continue;
      }
      remove(
        tool,
        makeReason(
          "context-filter",
          "Tool removed by background subagent filter 2 (T2).",
        ),
      );
    }
  }

  return {
    tools: tools.filter((tool) => !removed.has(tool)),
    removals,
  };
}
