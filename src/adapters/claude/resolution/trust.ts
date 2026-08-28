import type {
  ResolutionReason,
  SourceInfo,
  TrustState,
} from "../../../core/model/index.js";
import type {
  ClaudeAgent as Agent,
  RedactedMcpServer,
} from "../model/index.js";
import { FACT, type FactId } from "../version/facts.js";

export type TrustGatedKind = "inline-mcp" | "agent-hooks";

export interface ResolveTrustInput {
  agent: Agent;
  trust: TrustState;
  kind: TrustGatedKind;
  /** Entry from frontmatter.mcpServers when kind is inline-mcp. */
  mcpServerEntry?: string | RedactedMcpServer;
  mcpServerIndex?: number;
}

export interface ResolveTrustResult {
  /**
   * `unknown` when the trust rules do not cover the source, or when the trust
   * record itself could not be determined. Never collapsed to available/blocked.
   */
  status: "available" | "blocked_by_trust" | "unknown";
  /** Whether this resource is subject to project trust rules (R1/R5). */
  gated: boolean;
  reasons: ResolutionReason[];
}

const TRUST_EXEMPT_SCOPES = new Set<SourceInfo["scope"]>([
  "user",
  "cli",
  "managed",
  "plugin",
]);

function makeReason(
  type: ResolutionReason["type"],
  message: string,
  source?: SourceInfo,
  matrixRef?: FactId,
): ResolutionReason {
  return matrixRef
    ? { type, message, source, matrixRef }
    : source
      ? { type, message, source }
      : { type, message };
}

function fieldSource(agent: Agent, fieldPath: string): SourceInfo {
  return { ...agent.source, fieldPath };
}

/** Inline MCP definition in agent frontmatter (object), not a named reference (string). */
export function isInlineMcpServerEntry(
  entry: string | RedactedMcpServer,
): boolean {
  return typeof entry === "object" && entry !== null && !Array.isArray(entry);
}

/** MCP servers discovered from `.mcp.json` are never trust-gated (R1 critical note). */
export function isMcpConfigFileSource(source: SourceInfo): boolean {
  const normalized = source.path?.replace(/\\/g, "/") ?? "";
  return normalized.endsWith(".mcp.json");
}

/**
 * Project-scoped agents (and add-dir `.claude/agents/`) require trust for R1/R5.
 * User, CLI, managed, and plugin scopes are exempt (R4).
 */
export function isTrustGatedAgent(agent: Agent): boolean {
  return !TRUST_EXEMPT_SCOPES.has(agent.source.scope);
}

function hasDeclaredHooks(agent: Agent): boolean {
  const hooks = agent.configuration.hooks;
  if (!hooks) {
    return false;
  }
  if (hooks.form === "scalar") {
    return true;
  }
  return hooks.count > 0 || hooks.events.length > 0;
}

function unknownResult(
  message: string,
  source: SourceInfo,
  matrixRef?: FactId,
): ResolveTrustResult {
  return {
    status: "unknown",
    gated: false,
    reasons: [makeReason("unknown", message, source, matrixRef)],
  };
}

function availableReason(
  agent: Agent,
  kind: TrustGatedKind,
  matrixRef: FactId,
  message: string,
): ResolveTrustResult {
  const fieldPath =
    kind === "inline-mcp" ? "frontmatter.mcpServers" : "frontmatter.hooks";
  return {
    status: "available",
    gated: false,
    reasons: [
      makeReason("trust", message, fieldSource(agent, fieldPath), matrixRef),
    ],
  };
}

/**
 * Resolve whether an agent resource is blocked by missing project trust.
 * @see docs/SPEC.md R1, R4, R5, §7.2
 */
export function resolveTrustGate(input: ResolveTrustInput): ResolveTrustResult {
  const { agent, trust, kind, mcpServerEntry, mcpServerIndex } = input;

  if (kind === "inline-mcp") {
    if (mcpServerEntry === undefined) {
      return unknownResult(
        "No MCP server entry provided for inline-mcp trust resolution.",
        agent.source,
      );
    }

    if (!isInlineMcpServerEntry(mcpServerEntry)) {
      return availableReason(
        agent,
        kind,
        FACT.R4,
        "Named MCP server reference does not require project trust (R4).",
      );
    }

    if (!isTrustGatedAgent(agent)) {
      return availableReason(
        agent,
        kind,
        FACT.R4,
        `Inline MCP from ${agent.source.scope} scope loads without project trust (R4).`,
      );
    }
  }

  if (kind === "agent-hooks") {
    if (!hasDeclaredHooks(agent)) {
      return {
        status: "available",
        gated: false,
        reasons: [
          makeReason(
            "declared",
            "No frontmatter hooks declared.",
            fieldSource(agent, "frontmatter.hooks"),
          ),
        ],
      };
    }

    if (!isTrustGatedAgent(agent)) {
      return availableReason(
        agent,
        kind,
        FACT.R4,
        `Agent hooks from ${agent.source.scope} scope run without project trust (R4).`,
      );
    }
  }

  const fieldPath =
    kind === "inline-mcp"
      ? `frontmatter.mcpServers[${mcpServerIndex ?? 0}]`
      : "frontmatter.hooks";
  const source = fieldSource(agent, fieldPath);
  const matrixRef: FactId = kind === "inline-mcp" ? FACT.R1 : FACT.R5;

  if (trust.accepted === "unknown") {
    return {
      status: "unknown",
      gated: true,
      reasons: [
        makeReason(
          "unknown",
          `Project trust state could not be determined; ${
            kind === "inline-mcp" ? "inline MCP server" : "agent frontmatter hooks"
          } resolution is unknown.${
            trust.unknownReason ? ` ${trust.unknownReason}` : ""
          }`,
          source,
          matrixRef,
        ),
      ],
    };
  }

  if (trust.accepted === true) {
    return {
      status: "available",
      gated: true,
      reasons: [
        makeReason(
          "trust",
          "Project trust accepted; resource loads normally.",
          source,
          matrixRef,
        ),
      ],
    };
  }

  const blockedMessage =
    kind === "inline-mcp"
      ? "Inline MCP server blocked until project trust is accepted (R1)."
      : "Agent frontmatter hooks blocked until project trust is accepted (R5).";

  return {
    status: "blocked_by_trust",
    gated: true,
    reasons: [
      makeReason("trust", blockedMessage, source, matrixRef),
    ],
  };
}

/**
 * Trust never applies to MCP configuration from `.mcp.json`.
 * @see docs/SPEC.md §7.2
 */
export function resolveMcpConfigFileTrust(
  source: SourceInfo,
): ResolveTrustResult {
  if (!isMcpConfigFileSource(source)) {
    return unknownResult("Source is not an MCP configuration file.", source);
  }

  return {
    status: "available",
    gated: false,
    reasons: [
      makeReason(
        "trust",
        "MCP servers from .mcp.json are not subject to project trust (R4).",
        source,
        FACT.R4,
      ),
    ],
  };
}
