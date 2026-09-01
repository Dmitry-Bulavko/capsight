import type { ClaudeAgentConfiguration as AgentConfiguration } from "../model/index.js";
import { getStringField } from "../parsing/frontmatter.js";
import { redactMcpServers, redactUnknownFields, summarizeHooks } from "../discovery/redact.js";

export const KNOWN_AGENT_FRONTMATTER_KEYS = new Set([
  "name",
  "description",
  "tools",
  "disallowedTools",
  "model",
  "permissionMode",
  "maxTurns",
  "skills",
  "hooks",
  "mcpServers",
  "memory",
  "background",
  "effort",
  "isolation",
  "color",
  "initialPrompt",
]);

export function buildAgentConfiguration(data: Record<string, unknown>): AgentConfiguration {
  const unknownFields = redactUnknownFields(data, KNOWN_AGENT_FRONTMATTER_KEYS);

  return {
    tools: Array.isArray(data.tools) ? data.tools.map(String) : undefined,
    disallowedTools: Array.isArray(data.disallowedTools)
      ? data.disallowedTools.map(String)
      : undefined,
    mcpServers: redactMcpServers(data.mcpServers),
    model: getStringField(data, "model"),
    permissionMode: getStringField(data, "permissionMode") as AgentConfiguration["permissionMode"],
    maxTurns: typeof data.maxTurns === "number" ? data.maxTurns : undefined,
    skills: Array.isArray(data.skills) ? data.skills.map(String) : undefined,
    hooks: summarizeHooks(data.hooks),
    memory: getStringField(data, "memory") as AgentConfiguration["memory"],
    background: typeof data.background === "boolean" ? data.background : undefined,
    effort: getStringField(data, "effort"),
    isolation: getStringField(data, "isolation") as AgentConfiguration["isolation"],
    initialPrompt: getStringField(data, "initialPrompt"),
    color: getStringField(data, "color"),
    unknownFields,
  };
}
