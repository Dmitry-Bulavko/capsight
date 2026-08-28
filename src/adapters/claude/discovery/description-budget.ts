import type {
  SourceInfo,
  Warning,
} from "../../../core/model/index.js";
import type { ClaudeAgent as Agent } from "../model/index.js";
import { gateWarning, MATRIX } from "../version/matrix.js";

/** A10 threshold — total estimated description tokens before warning. */
export const DESCRIPTION_BUDGET_THRESHOLD = 15_000;

export interface AgentDescriptionContribution {
  agentId: string;
  agentName: string;
  estimatedTokens: number;
  source: SourceInfo;
}

export interface DescriptionBudgetResult {
  totalEstimatedTokens: number;
  contributions: AgentDescriptionContribution[];
  warnings: Warning[];
}

/** Rough token estimate: character count / 4. */
export function estimateDescriptionTokens(description: string): number {
  return Math.ceil(description.length / 4);
}

/** User-defined agents counted toward the description budget (§7.7 A10). */
export function isUserAgentForBudget(agent: Agent): boolean {
  return !agent.isPluginAgent && agent.status !== "invalid";
}

function formatBreakdown(contributions: AgentDescriptionContribution[]): string {
  return [...contributions]
    .sort((left, right) => right.estimatedTokens - left.estimatedTokens)
    .map((entry) => `${entry.agentName}: ~${entry.estimatedTokens}`)
    .join("; ");
}

/**
 * Count description tokens across user agents and emit a budget warning when over threshold.
 *
 * The warning claims platform behaviour — that Claude Code warns at startup
 * above the A10 budget — so it goes through the matrix and reads `unknown`
 * when the entry does not found it on this version (§8.2, §8.3).
 *
 * @see docs/SPEC.md §7.7, A10
 */
export function computeDescriptionBudget(
  agents: Agent[],
  /** Detected CLI version, `"unknown"` in degraded mode (§8.3). */
  version = "unknown",
): DescriptionBudgetResult {
  const contributions: AgentDescriptionContribution[] = [];

  for (const agent of agents) {
    if (!isUserAgentForBudget(agent)) {
      continue;
    }

    contributions.push({
      agentId: agent.id,
      agentName: agent.name,
      estimatedTokens: estimateDescriptionTokens(agent.description),
      source: agent.source,
    });
  }

  const totalEstimatedTokens = contributions.reduce(
    (sum, entry) => sum + entry.estimatedTokens,
    0,
  );

  const warnings: Warning[] = [];

  if (totalEstimatedTokens > DESCRIPTION_BUDGET_THRESHOLD) {
    warnings.push(
      gateWarning(
        {
          category: "budget",
          severity: "warning",
          message: `Agent description budget exceeds ${DESCRIPTION_BUDGET_THRESHOLD} tokens (~${totalEstimatedTokens} estimated). Per-agent: ${formatBreakdown(contributions)}`,
          evidence: contributions.map((entry) => ({
            ...entry.source,
            fieldPath: "frontmatter.description",
          })),
          // A10 is a startup warning, not a restriction the platform applies
          // (§6: `description` is advisory), so `advisory` is the ceiling.
          enforcement: "advisory",
        },
        MATRIX["agent.descriptionBudget"],
        version,
      ),
    );
  }

  return { totalEstimatedTokens, contributions, warnings };
}
