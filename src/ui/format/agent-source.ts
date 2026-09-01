import type { Agent } from "../../core/model/index.js";

export function agentPath(agent: Agent): string {
  return agent.source.path ?? "—";
}
