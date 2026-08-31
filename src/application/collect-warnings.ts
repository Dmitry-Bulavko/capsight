import type { ExecutionContext, ProjectSnapshot, Warning } from "../core/model/index.js";
import { resolve } from "./resolve.js";

export interface AgentWarning extends Warning {
  agentId: string;
}

export interface CollectAgentWarningsOptions {
  snapshot: ProjectSnapshot;
  context: ExecutionContext;
}

/**
 * Collect warnings for all active agents in a snapshot. §7.6
 */
export async function collectAgentWarnings(
  options: CollectAgentWarningsOptions,
): Promise<AgentWarning[]> {
  const { snapshot, context } = options;
  const warnings: AgentWarning[] = [];
  const activeAgents = snapshot.agents.filter((agent) => agent.status === "active");

  for (const agent of activeAgents) {
    const effective = await resolve({
      snapshot,
      agentId: agent.id,
      context,
    });
    for (const warning of effective.warnings) {
      warnings.push({ ...warning, agentId: agent.id });
    }
  }

  return warnings;
}
