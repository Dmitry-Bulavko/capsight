import type { Agent, ResolutionReason, SourceInfo } from "../../../core/model/index.js";
import { FACT, type FactId } from "../version/facts.js";

/** Frontmatter fields ignored for plugin agents (F9). */
export const PLUGIN_INEFFECTIVE_FIELDS = [
  "hooks",
  "mcpServers",
  "permissionMode",
] as const;

export type PluginIneffectiveField = (typeof PLUGIN_INEFFECTIVE_FIELDS)[number];

export interface ResolvePluginFieldResult {
  field: PluginIneffectiveField;
  declared: unknown;
  effective: undefined;
  ineffective: boolean;
  reasons: ResolutionReason[];
}

function makeReason(
  type: ResolutionReason["type"],
  message: string,
  source: SourceInfo,
  matrixRef?: FactId,
): ResolutionReason {
  return matrixRef
    ? { type, message, source, matrixRef }
    : { type, message, source };
}

function fieldSource(agent: Agent, field: PluginIneffectiveField): SourceInfo {
  return { ...agent.source, fieldPath: `frontmatter.${field}` };
}

function readDeclaredField(agent: Agent, field: PluginIneffectiveField): unknown {
  return agent.configuration[field];
}

function isDeclared(value: unknown): boolean {
  return value !== undefined && value !== null;
}

export function isPluginIneffectiveField(
  field: string,
): field is PluginIneffectiveField {
  return (PLUGIN_INEFFECTIVE_FIELDS as readonly string[]).includes(field);
}

/**
 * Resolve F9 ineffective fields for a plugin agent.
 * Non-plugin agents return an empty list.
 * @see docs/SPEC.md F9, §7.4
 */
export function resolvePluginFieldLimitations(
  agent: Agent,
): ResolvePluginFieldResult[] {
  if (!agent.isPluginAgent) {
    return [];
  }

  const results: ResolvePluginFieldResult[] = [];

  for (const field of PLUGIN_INEFFECTIVE_FIELDS) {
    const declared = readDeclaredField(agent, field);
    if (!isDeclared(declared)) {
      continue;
    }

    const source = fieldSource(agent, field);
    results.push({
      field,
      declared,
      effective: undefined,
      ineffective: true,
      reasons: [
        makeReason(
          "plugin-limitation",
          `Plugin agents ignore frontmatter ${field} (F9).`,
          source,
          FACT.F9,
        ),
      ],
    });
  }

  return results;
}
