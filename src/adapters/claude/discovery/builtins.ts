import { createHash } from "node:crypto";
import type { SourceInfo } from "../../../core/model/index.js";
import type { ClaudeAgent as Agent } from "../model/index.js";

/** B1 built-in agent names (§3.9). */
export const BUILTIN_AGENT_NAMES = [
  "Explore",
  "Plan",
  "general-purpose",
  "claude",
  "statusline-setup",
  "claude-code-guide",
] as const;

export type BuiltinAgentName = (typeof BUILTIN_AGENT_NAMES)[number];

const BUILTIN_DESCRIPTIONS: Record<BuiltinAgentName, string> = {
  Explore: "Built-in agent for exploring codebases (B1)",
  Plan: "Built-in agent for planning tasks (B1)",
  "general-purpose": "Built-in general-purpose agent (B1)",
  claude: "Built-in claude agent (B1)",
  "statusline-setup": "Built-in statusline setup agent (B1)",
  "claude-code-guide": "Built-in Claude Code guide agent (B1)",
};

function builtinId(name: string): string {
  return createHash("sha256")
    .update(`claude:builtin:${name}`)
    .digest("hex")
    .slice(0, 16);
}

function builtinSource(): SourceInfo {
  return { platform: "claude", scope: "builtin" };
}

/** Synthetic B1 inventory records — not read from disk (§3.9). */
export function synthesizeBuiltinAgents(): Agent[] {
  return BUILTIN_AGENT_NAMES.map((name) => ({
    id: builtinId(name),
    name,
    description: BUILTIN_DESCRIPTIONS[name],
    source: builtinSource(),
    status: "active" as const,
    configuration: { unknownFields: {} },
    isPluginAgent: false,
  }));
}

export function isBuiltinAgent(agent: Agent): boolean {
  return agent.source.scope === "builtin";
}
