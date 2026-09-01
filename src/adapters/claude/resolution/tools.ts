import type {
  ResolvedCapability,
  ResolutionReason,
  SourceInfo,
} from "../../../core/model/index.js";
import { makeReason } from "../../../core/resolver/reasons.js";
import { AGENT_TOOL_NAMES, isMcpTool } from "./tool-tables.js";
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
  | { kind: "agent-types"; head: string; types: string[] }
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

/**
 * Outcome of matching one pattern against one tool name.
 * @see docs/SPEC.md F11
 */
interface NameMatch {
  /**
   * `true` when the match only held because `Agent` and `Task` were treated as
   * the same tool. Tracked per match so the F11 version gate lands on the
   * verdicts that relied on the rename alias and on no others.
   */
  aliasDependent: boolean;
}

const NAME_MATCH_DIRECT: NameMatch = { aliasDependent: false };
const NAME_MATCH_ALIAS: NameMatch = { aliasDependent: true };

/** @returns `null` when the pattern does not name this tool at all. */
function matchToolName(pattern: string, toolName: string): NameMatch | null {
  if (pattern === toolName) {
    return NAME_MATCH_DIRECT;
  }
  return AGENT_ALIAS_SET.has(pattern) && AGENT_ALIAS_SET.has(toolName)
    ? NAME_MATCH_ALIAS
    : null;
}

/**
 * Match a tool against a list of raw pattern strings, preferring a match that
 * names the tool directly: such a match holds on every version, so the alias
 * gate must not be triggered by an incidental second match through the alias.
 */
function matchAnyToolName(
  patterns: readonly string[],
  toolName: string,
): NameMatch | null {
  let aliasMatch: NameMatch | null = null;
  for (const pattern of patterns) {
    const match = matchToolName(pattern, toolName);
    if (!match) {
      continue;
    }
    if (!match.aliasDependent) {
      return match;
    }
    aliasMatch = match;
  }
  return aliasMatch;
}

/**
 * A verdict relied on the alias only when *every* match behind it did; one
 * match naming the tool directly holds on any version, so the verdict stands.
 */
function reliesOnAlias(matches: readonly MatchedPattern[]): boolean {
  return matches.length > 0 && matches.every((match) => match.aliasDependent);
}

/**
 * Second gate for a verdict that only holds because `Task` and `Agent` name the
 * same tool. The rename landed in v2.1.63 and `Task(...)` is an alias only from
 * there (F11), so below that version — and in degraded mode — the verdict has
 * no basis and degrades on both axes, exactly like any other ungated rule.
 * Verdicts that never went through the alias are left untouched.
 *
 * @see docs/SPEC.md F11, §8.2, §8.3, §13 invariant 11
 */
function gateAliasDependent<T extends ResolvedCapability>(
  capability: T,
  aliasDependent: boolean,
  version: string,
): T {
  return aliasDependent
    ? gateCapability(capability, MATRIX["agent.toolAliases"], version)
    : capability;
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
        return { kind: "agent-types", head, types };
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

function patternMatchesTool(
  parsed: ParsedPattern,
  toolName: string,
): NameMatch | null {
  switch (parsed.kind) {
    case "exact":
      return matchToolName(parsed.value, toolName);
    case "mcp-all":
      return isMcpTool(toolName) ? NAME_MATCH_DIRECT : null;
    case "mcp-server":
      return toolName === `mcp__${parsed.server}` ||
        toolName.startsWith(`mcp__${parsed.server}__`)
        ? NAME_MATCH_DIRECT
        : null;
    case "mcp-server-wildcard":
      return toolName.startsWith(`mcp__${parsed.server}__`)
        ? NAME_MATCH_DIRECT
        : null;
    case "agent-types":
      // F5: inside a subagent definition the type list in parentheses is
      // ignored; the entry still selects the Agent/Task tool itself, under the
      // name it was written with — `Task(...)` reaches `Agent` only via F11.
      return matchToolName(parsed.head, toolName);
    case "unknown":
      return null;
  }
}

function capabilityKind(toolName: string): ResolvedCapability["kind"] {
  return isMcpTool(toolName) ? "mcp_tool" : "tool";
}

type MatchedPattern = IndexedPattern & Pick<NameMatch, "aliasDependent">;

function findMatchingPatterns(
  toolName: string,
  patterns: readonly IndexedPattern[],
): MatchedPattern[] {
  const matches: MatchedPattern[] = [];
  for (const entry of patterns) {
    if (entry.parsed.kind === "unknown") {
      continue;
    }
    const match = patternMatchesTool(entry.parsed, toolName);
    if (match) {
      matches.push({ ...entry, aliasDependent: match.aliasDependent });
    }
  }
  return matches;
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
  return patternMatchesTool(head, toolName) !== null;
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

function declaredInBothLists(
  toolName: string,
  tools: readonly string[] | undefined,
  disallowedTools: readonly string[] | undefined,
): NameMatch | null {
  if (!tools || !disallowedTools) {
    return null;
  }
  const allowed = matchAnyToolName(tools, toolName);
  const denied = matchAnyToolName(disallowedTools, toolName);
  if (!allowed || !denied) {
    return null;
  }
  // Either side reaching the tool only through the alias makes the combined
  // verdict alias-dependent.
  return {
    aliasDependent: allowed.aliasDependent || denied.aliasDependent,
  };
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
    const inBothLists = declaredInBothLists(toolName, tools, disallowedTools);
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
        gateAliasDependent(
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
          inBothLists.aliasDependent,
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
        gateAliasDependent(
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
          reliesOnAlias(deniedMatches),
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
      gateAliasDependent(
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
        reliesOnAlias(allowedMatches),
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
