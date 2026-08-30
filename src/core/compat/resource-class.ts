/**
 * Platform-neutral resource-class identifiers for cross-platform compatibility.
 * Path patterns that map discovery paths to a class live in adapters only.
 * @see docs/COMPAT-FACTS.md, docs/tasks/EC-01-compat-facts.md
 */

export const RESOURCE_CLASS = {
  AGENT_MARKDOWN: "agent@markdown",
  SKILL_DIRECTORY: "skill@directory",
  COMMAND_MARKDOWN: "command@markdown",
  INSTRUCTION_AGENTS_MD: "instruction@AGENTS.md",
  INSTRUCTION_AGENTS_OVERRIDE_MD: "instruction@AGENTS.override.md",
  INSTRUCTION_CLAUDE_MD: "instruction@CLAUDE.md",
  INSTRUCTION_CLAUDE_LOCAL_MD: "instruction@CLAUDE.local.md",
  INSTRUCTION_RULE_MDC: "instruction@rule-mdc",
  INSTRUCTION_CURSORRULES: "instruction@cursorrules",
  INSTRUCTION_FALLBACK_DOC: "instruction@fallback-doc",
  MCP_JSON_CONFIG: "mcp@json-config",
  MCP_TOML_CONFIG: "mcp@toml-config",
  MCP_INLINE_AGENT: "mcp@inline-agent",
  SETTINGS_JSON: "settings@json",
  SETTINGS_TOML: "settings@toml",
} as const;

export type ResourceClass = (typeof RESOURCE_CLASS)[keyof typeof RESOURCE_CLASS];

export const ALL_RESOURCE_CLASSES: readonly ResourceClass[] = Object.values(RESOURCE_CLASS);

export function isResourceClass(value: string): value is ResourceClass {
  return (ALL_RESOURCE_CLASSES as readonly string[]).includes(value);
}
