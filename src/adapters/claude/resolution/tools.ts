import type {
  ResolvedCapability,
  ResolutionReason,
  SourceInfo,
} from "../../../core/model/index.js";
import { AGENT_TOOL_NAMES, isMcpTool } from "../../../core/resolver/builtin-tools.js";
import { MATRIX, gateCapability } from "../version/matrix.js";

export interface ResolveAgentToolsInput {
  /** Parent session tool pool before agent frontmatter filters. */
  parentPool: readonly string[];
  /**
   * Detected Claude Code version, or `"unknown"` in degraded mode. Every
   * verdict below is gated on the matrix for this version (§8.2, §8.3).
   */
  version: string;
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
  | { kind: "agent-types"; types: string[] }
  | { kind: "unknown"; raw: string };

interface IndexedPattern {
  raw: string;
  index: number;
  field: "tools" | "disallowedTools";
  parsed: ParsedPattern;
}

const AGENT_ALIAS_SET = new Set<string>(AGENT_TOOL_NAMES);

/** `Head(...)` form, e.g. `Agent(type1, type2)` (F5) or `Bash(git diff:*)`. */
const PARENTHESISED_PATTERN = /^([^()]*)\((.*)\)$/;

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

  const parenthesised = PARENTHESISED_PATTERN.exec(pattern);
  if (parenthesised) {
    const head = parenthesised[1]!;
    const inner = parenthesised[2]!;
    if (AGENT_ALIAS_SET.has(head) && !inner.includes("(") && !inner.includes(")")) {
      const types = inner
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
      if (types.length > 0) {
        return { kind: "agent-types", types };
      }
    }
    return { kind: "unknown", raw: pattern };
  }

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
    case "agent-types":
      // F5: inside a subagent definition the type list in parentheses is
      // ignored; the entry still selects the Agent/Task tool itself.
      return exactPatternMatches(AGENT_TOOL_NAMES[0], toolName);
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

/**
 * Conservative bound on which tools an unparseable pattern could have referred
 * to. Only the head before "(" is used, and only when it parses on its own
 * (`Bash(git diff:*)` -> `Bash`); anything else could mean any tool, so every
 * tool is treated as possibly matched. Never narrower than the truth: an
 * unparseable restriction may only downgrade a verdict, never widen it.
 * @see docs/SPEC.md §13 invariant 4, F3
 */
function unknownPatternCouldMatch(raw: string, toolName: string): boolean {
  const parenIndex = raw.indexOf("(");
  if (parenIndex <= 0) {
    return true;
  }
  const head = parseToolPattern(raw.slice(0, parenIndex).trim(), {
    allowMcpAll: true,
  });
  if (head.kind === "unknown") {
    return true;
  }
  return patternMatchesTool(head, toolName);
}

function unknownPatternReason(
  entry: IndexedPattern,
  agentSource: SourceInfo,
): ResolutionReason {
  const source = patternSource(agentSource, entry.field, entry.index);
  const message =
    entry.field === "tools"
      ? `Tool pattern "${entry.raw}" could not be parsed; whether it includes this tool is unknown (F3, F4).`
      : `disallowedTools pattern "${entry.raw}" could not be parsed; whether it removes this tool is unknown (F2, F3).`;
  return makeReason("unknown", message, source);
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
  version: string,
): ResolvedCapability[] {
  return patterns
    .filter((entry) => entry.parsed.kind === "unknown")
    .map((entry) => gateCapability({
      capabilityId: entry.raw,
      kind: "tool" as const,
      status: "unknown" as const,
      enforcement: "unknown" as const,
      sources: [patternSource(agentSource, entry.field, entry.index)],
      reasons: [
        makeReason(
          "unknown",
          "Unrecognized tool pattern syntax; its effect on the tool pool is unknown (F3).",
          patternSource(agentSource, entry.field, entry.index),
        ),
      ],
    }, entry.field === "tools" ? MATRIX["agent.tools"] : MATRIX["agent.disallowedTools"], version));
}

/**
 * Resolve agent tool pool from frontmatter tools/disallowedTools (F2, F3, F11).
 * Context filters (T1/T2) are applied separately via applyContextFilters.
 * @see docs/SPEC.md §3.2 F2–F4, F11
 */
export function resolveAgentTools(
  input: ResolveAgentToolsInput,
): ResolveAgentToolsResult {
  const { parentPool, version, tools, disallowedTools, agentSource } = input;

  const disallowedPatterns = indexPatterns(disallowedTools, "disallowedTools", true);
  const whitelistPatterns = indexPatterns(tools, "tools", false);
  const effectiveWhitelist = whitelistPatterns.filter(
    (entry) => entry.parsed.kind !== "unknown",
  );
  const unknownWhitelist = whitelistPatterns.filter(
    (entry) => entry.parsed.kind === "unknown",
  );
  const unknownDisallowed = disallowedPatterns.filter(
    (entry) => entry.parsed.kind === "unknown",
  );
  // A declared `tools` list always applies, even when nothing in it parses:
  // dropping it would turn an unreadable restriction into "whole parent pool
  // available" (§0.1.2, §13 invariant 4).
  const applyWhitelist = tools !== undefined;
  // Nothing in `tools` parsed at all: the selection itself is unreadable, so no
  // tool in the pool can be resolved either way (F4).
  const whitelistFullyUnparsed =
    applyWhitelist && effectiveWhitelist.length === 0 && unknownWhitelist.length > 0;

  const capabilities: ResolvedCapability[] = [];
  const pool: string[] = [];

  for (const toolName of parentPool) {
    const inBothLists = isDeclaredInBothLists(toolName, tools, disallowedTools);
    const deniedMatches = findMatchingPatterns(toolName, disallowedPatterns);
    const allowedMatches = findMatchingPatterns(toolName, effectiveWhitelist);
    const unknownAllowMatches = unknownWhitelist.filter(
      (entry) =>
        whitelistFullyUnparsed || unknownPatternCouldMatch(entry.raw, toolName),
    );
    const unknownDenyMatches = unknownDisallowed.filter((entry) =>
      unknownPatternCouldMatch(entry.raw, toolName),
    );

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

      capabilities.push(
        gateCapability(
          {
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
          },
          MATRIX["agent.disallowedTools"],
          version,
        ),
      );
      continue;
    }

    if (deniedMatches.length > 0) {
      const source = patternSource(
        agentSource,
        deniedMatches[0]!.field,
        deniedMatches[0]!.index,
      );
      capabilities.push(
        gateCapability(
          {
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
          },
          MATRIX["agent.disallowedTools"],
          version,
        ),
      );
      continue;
    }

    if (
      applyWhitelist &&
      allowedMatches.length === 0 &&
      unknownAllowMatches.length === 0
    ) {
      capabilities.push(
        gateCapability(
          {
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
          },
          MATRIX["agent.tools"],
          version,
        ),
      );
      continue;
    }

    // An unparseable pattern that could have covered this tool leaves the
    // verdict unknown; it never resolves to available or denied (§13 invariant 4).
    const blockingUnknown = [
      ...(allowedMatches.length === 0 ? unknownAllowMatches : []),
      ...unknownDenyMatches,
    ];
    if (blockingUnknown.length > 0) {
      capabilities.push(
        gateCapability(
          {
            capabilityId: toolName,
            kind: capabilityKind(toolName),
            status: "unknown",
            enforcement: "unknown",
            sources: blockingUnknown.map((entry) =>
              patternSource(agentSource, entry.field, entry.index),
            ),
            reasons: blockingUnknown.map((entry) =>
              unknownPatternReason(entry, agentSource),
            ),
          },
          MATRIX["agent.tools"],
          version,
        ),
      );
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

    capabilities.push(
      gateCapability(
        {
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
        },
        MATRIX["agent.tools"],
        version,
      ),
    );
    pool.push(toolName);
  }

  capabilities.push(
    ...unknownPatternCapabilities(disallowedPatterns, agentSource, version),
    ...unknownPatternCapabilities(whitelistPatterns, agentSource, version),
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
