import type {
  ResolvedCapability,
  ResolutionReason,
  SourceInfo,
} from "../../../core/model/index.js";
import { AGENT_TOOL_NAMES, isMcpTool } from "../../../core/resolver/builtin-tools.js";

export interface ResolveAgentToolsInput {
  /** Parent session tool pool before agent frontmatter filters. */
  parentPool: readonly string[];
  tools?: readonly string[];
  disallowedTools?: readonly string[];
  agentSource: SourceInfo;
}

export interface ResolveAgentToolsResult {
  capabilities: ResolvedCapability[];
  /** Tool names remaining after F2/F3 pool resolution (before context filters). */
  pool: string[];
}

type ParsedPattern =
  | { kind: "exact"; value: string }
  | { kind: "mcp-all" }
  | { kind: "mcp-server"; server: string }
  | { kind: "mcp-server-wildcard"; server: string }
  | { kind: "unknown"; raw: string };

interface IndexedPattern {
  raw: string;
  index: number;
  field: "tools" | "disallowedTools";
  parsed: ParsedPattern;
}

const AGENT_ALIAS_SET = new Set<string>(AGENT_TOOL_NAMES);

function fieldPath(field: IndexedPattern["field"], index: number): string {
  return `frontmatter.${field}[${index}]`;
}

function patternSource(
  agentSource: SourceInfo,
  field: IndexedPattern["field"],
  index: number,
): SourceInfo {
  return { ...agentSource, fieldPath: fieldPath(field, index) };
}

function makeReason(
  type: ResolutionReason["type"],
  message: string,
  source?: SourceInfo,
): ResolutionReason {
  return source ? { type, message, source } : { type, message };
}

function expandAliases(toolName: string): string[] {
  if (AGENT_ALIAS_SET.has(toolName)) {
    return [...AGENT_TOOL_NAMES];
  }
  return [toolName];
}

function exactPatternMatches(pattern: string, toolName: string): boolean {
  return expandAliases(pattern).some(
    (alias) => expandAliases(toolName).includes(alias),
  );
}

/** @see docs/SPEC.md F3, S3 */
export function parseToolPattern(
  pattern: string,
  options: { allowMcpAll?: boolean } = {},
): ParsedPattern {
  const allowMcpAll = options.allowMcpAll ?? false;

  if (pattern.includes("(") || pattern.includes(")")) {
    return { kind: "unknown", raw: pattern };
  }

  if (pattern === "mcp__*") {
    return allowMcpAll ? { kind: "mcp-all" } : { kind: "unknown", raw: pattern };
  }

  if (!pattern.startsWith("mcp__")) {
    return { kind: "exact", value: pattern };
  }

  if (pattern.endsWith("__*")) {
    const server = pattern.slice("mcp__".length, -"__*".length);
    if (!server || server.includes("__")) {
      return { kind: "unknown", raw: pattern };
    }
    return { kind: "mcp-server-wildcard", server };
  }

  const segments = pattern.split("__");
  if (segments.length === 2 && segments[0] === "mcp" && segments[1]) {
    return { kind: "mcp-server", server: segments[1] };
  }

  if (segments.length >= 3 && segments[0] === "mcp" && segments[1]) {
    return { kind: "exact", value: pattern };
  }

  return { kind: "unknown", raw: pattern };
}

function patternMatchesTool(parsed: ParsedPattern, toolName: string): boolean {
  switch (parsed.kind) {
    case "exact":
      return exactPatternMatches(parsed.value, toolName);
    case "mcp-all":
      return isMcpTool(toolName);
    case "mcp-server":
      return (
        toolName === `mcp__${parsed.server}` ||
        toolName.startsWith(`mcp__${parsed.server}__`)
      );
    case "mcp-server-wildcard":
      return toolName.startsWith(`mcp__${parsed.server}__`);
    case "unknown":
      return false;
  }
}

function capabilityKind(toolName: string): ResolvedCapability["kind"] {
  return isMcpTool(toolName) ? "mcp_tool" : "tool";
}

function findMatchingPatterns(
  toolName: string,
  patterns: readonly IndexedPattern[],
): IndexedPattern[] {
  return patterns.filter(
    (entry) =>
      entry.parsed.kind !== "unknown" && patternMatchesTool(entry.parsed, toolName),
  );
}

function isDeclaredInBothLists(
  toolName: string,
  tools: readonly string[] | undefined,
  disallowedTools: readonly string[] | undefined,
): boolean {
  if (!tools || !disallowedTools) {
    return false;
  }
  return (
    tools.some((pattern) => exactPatternMatches(pattern, toolName)) &&
    disallowedTools.some((pattern) => exactPatternMatches(pattern, toolName))
  );
}

function indexPatterns(
  patterns: readonly string[] | undefined,
  field: IndexedPattern["field"],
  allowMcpAll: boolean,
): IndexedPattern[] {
  if (!patterns) {
    return [];
  }
  return patterns.map((raw, index) => ({
    raw,
    index,
    field,
    parsed: parseToolPattern(raw, { allowMcpAll }),
  }));
}

function unknownPatternCapabilities(
  patterns: readonly IndexedPattern[],
  agentSource: SourceInfo,
): ResolvedCapability[] {
  return patterns
    .filter((entry) => entry.parsed.kind === "unknown")
    .map((entry) => ({
      capabilityId: entry.raw,
      kind: "tool" as const,
      status: "unknown" as const,
      enforcement: "unknown" as const,
      sources: [patternSource(agentSource, entry.field, entry.index)],
      reasons: [
        makeReason(
          "unknown",
          "Unrecognized tool pattern syntax; not applied (F3).",
          patternSource(agentSource, entry.field, entry.index),
        ),
      ],
    }));
}

/**
 * Resolve agent tool pool from frontmatter tools/disallowedTools (F2, F3, F11).
 * Context filters (T1/T2) are applied separately via applyContextFilters.
 * @see docs/SPEC.md §3.2 F2–F4, F11
 */
export function resolveAgentTools(
  input: ResolveAgentToolsInput,
): ResolveAgentToolsResult {
  const { parentPool, tools, disallowedTools, agentSource } = input;

  const disallowedPatterns = indexPatterns(disallowedTools, "disallowedTools", true);
  const whitelistPatterns = indexPatterns(tools, "tools", false);
  const effectiveWhitelist = whitelistPatterns.filter(
    (entry) => entry.parsed.kind !== "unknown",
  );
  const applyWhitelist = tools !== undefined && effectiveWhitelist.length > 0;

  const capabilities: ResolvedCapability[] = [];
  const pool: string[] = [];

  for (const toolName of parentPool) {
    const inBothLists = isDeclaredInBothLists(toolName, tools, disallowedTools);
    const deniedMatches = findMatchingPatterns(toolName, disallowedPatterns);
    const allowedMatches = findMatchingPatterns(toolName, effectiveWhitelist);

    if (inBothLists) {
      const sources = [
        ...allowedMatches.map((entry) =>
          patternSource(agentSource, entry.field, entry.index),
        ),
        ...deniedMatches.map((entry) =>
          patternSource(agentSource, entry.field, entry.index),
        ),
      ];
      const uniqueSources = dedupeSources(sources);

      capabilities.push({
        capabilityId: toolName,
        kind: capabilityKind(toolName),
        status: "denied",
        enforcement: "enforced",
        sources: uniqueSources,
        reasons: [
          makeReason(
            "denied",
            "Declared in both tools and disallowedTools; removed (F2).",
            uniqueSources[0],
          ),
        ],
      });
      continue;
    }

    if (deniedMatches.length > 0) {
      const source = patternSource(
        agentSource,
        deniedMatches[0]!.field,
        deniedMatches[0]!.index,
      );
      capabilities.push({
        capabilityId: toolName,
        kind: capabilityKind(toolName),
        status: "denied",
        enforcement: "enforced",
        sources: deniedMatches.map((entry) =>
          patternSource(agentSource, entry.field, entry.index),
        ),
        reasons: [
          makeReason(
            "denied",
            `Removed by disallowedTools pattern "${deniedMatches[0]!.raw}" (F2, F3).`,
            source,
          ),
        ],
      });
      continue;
    }

    if (applyWhitelist && allowedMatches.length === 0) {
      capabilities.push({
        capabilityId: toolName,
        kind: capabilityKind(toolName),
        status: "denied",
        enforcement: "enforced",
        sources: [agentSource],
        reasons: [
          makeReason(
            "denied",
            "Not included in tools whitelist (F2).",
            agentSource,
          ),
        ],
      });
      continue;
    }

    const reasons: ResolutionReason[] = [];
    if (allowedMatches.length > 0) {
      const source = patternSource(
        agentSource,
        allowedMatches[0]!.field,
        allowedMatches[0]!.index,
      );
      reasons.push(
        makeReason(
          "declared",
          `Allowed by tools pattern "${allowedMatches[0]!.raw}" (F2).`,
          source,
        ),
      );
    } else {
      reasons.push(
        makeReason(
          "inherited",
          "Inherited from parent session tool pool.",
          agentSource,
        ),
      );
    }

    capabilities.push({
      capabilityId: toolName,
      kind: capabilityKind(toolName),
      status: "available",
      enforcement: "enforced",
      sources:
        allowedMatches.length > 0
          ? allowedMatches.map((entry) =>
              patternSource(agentSource, entry.field, entry.index),
            )
          : [agentSource],
      reasons,
    });
    pool.push(toolName);
  }

  capabilities.push(
    ...unknownPatternCapabilities(disallowedPatterns, agentSource),
    ...unknownPatternCapabilities(whitelistPatterns, agentSource),
  );

  return { capabilities, pool };
}

function dedupeSources(sources: SourceInfo[]): SourceInfo[] {
  const seen = new Set<string>();
  const result: SourceInfo[] = [];
  for (const source of sources) {
    const key = `${source.path ?? ""}|${source.fieldPath ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(source);
  }
  return result;
}
