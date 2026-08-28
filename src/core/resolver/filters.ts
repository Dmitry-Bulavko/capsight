import type { ExecutionContext, ResolutionReason } from "../model/index.js";
import {
  isAgentTool,
  isBackgroundAllowedBuiltin,
  isFilter1RemovedTool,
  isMcpTool,
} from "./builtin-tools.js";

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

function makeReason(
  type: ResolutionReason["type"],
  message: string,
): ResolutionReason {
  return { type, message };
}

function isPlanMode(context: ExecutionContext): boolean {
  return context.preset === "plan" || context.builtinKind === "plan";
}

function shouldApplyFilter1(context: ExecutionContext): boolean {
  return !context.isMainSession && !context.isFork;
}

function shouldApplyFilter2(context: ExecutionContext): boolean {
  return context.isBackground && !context.isFork;
}

/**
 * Apply context filters T1/T2, fork skip (T3), and Agent depth limit (N2).
 * @see docs/SPEC.md §4.4 rules 1–3
 */
export function applyContextFilters(
  tools: readonly string[],
  context: ExecutionContext,
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

  const removals: ContextFilterRemoval[] = [];
  const removed = new Set<string>();

  const remove = (tool: string, reason: ResolutionReason): void => {
    if (!removed.has(tool)) {
      removed.add(tool);
      removals.push({ tool, reason });
    }
  };

  // §4.4 rule 2 / N2 — Agent unavailable at depth limit (fork handled above).
  if (context.depth >= context.maxDepth) {
    for (const tool of tools) {
      if (isAgentTool(tool)) {
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
    for (const tool of tools) {
      if (removed.has(tool) || !isFilter1RemovedTool(tool)) {
        continue;
      }
      if (tool === "ExitPlanMode" && isPlanMode(context)) {
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
      if (removed.has(tool) || isMcpTool(tool) || isBackgroundAllowedBuiltin(tool)) {
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
