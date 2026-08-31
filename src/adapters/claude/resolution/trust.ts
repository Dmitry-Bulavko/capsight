import path from "node:path";
import type {
  ResolutionReason,
  SourceInfo,
  TrustState,
} from "../../../core/model/index.js";
import type {
  ClaudeAgent as Agent,
  RedactedMcpServer,
} from "../model/index.js";
import { agentTrustFolder } from "../discovery/trust.js";
import { FACT, type FactId } from "../version/facts.js";
import { MATRIX, type MatrixId } from "../version/matrix.js";

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
  /** Matrix entry backing the trust verdict for version gating. */
  matrixRef: MatrixId;
}

const TRUST_EXEMPT_SCOPES = new Set<SourceInfo["scope"]>([
  "user",
  "cli",
  "managed",
  "plugin",
]);

type TrustRule = typeof FACT.R1 | typeof FACT.R5 | typeof FACT.R2 | typeof FACT.R6;

const TRUST_MATRIX_IDS: Record<TrustRule, MatrixId> = {
  [FACT.R1]: MATRIX["trust.inlineMcp"],
  [FACT.R5]: MATRIX["trust.frontmatterHooks"],
  [FACT.R2]: MATRIX["trust.parentFolder"],
  [FACT.R6]: MATRIX["trust.addDirSeparate"],
};

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

function trustFolderKey(folderPath: string): string {
  return path.resolve(folderPath).replace(/\\/g, "/");
}

function lookupFolderTrust(
  trust: TrustState,
  folderPath: string,
): boolean | "unknown" {
  const key = trustFolderKey(folderPath);
  const record = trust.folderRecords?.[key];
  if (record === "unknown") {
    return "unknown";
  }
  return record === true;
}

function agentTrustFolderAbsolute(agent: Agent, trust: TrustState): string {
  const agentPath = agent.source.path ?? ".";
  const relFolder = agentTrustFolder(agentPath);
  if (relFolder === ".") {
    return trust.projectPath;
  }
  if (path.isAbsolute(relFolder)) {
    return relFolder;
  }
  return path.resolve(trust.repoRoot ?? trust.projectPath, relFolder);
}

function resolveTrustRule(
  agent: Agent,
  trust: TrustState,
  kind: TrustGatedKind,
): { accepted: boolean | "unknown"; rule: TrustRule; matrixRef: MatrixId } {
  const defaultRule: TrustRule = kind === "inline-mcp" ? FACT.R1 : FACT.R5;
  const agentFolder = agentTrustFolderAbsolute(agent, trust);
  const projectKey = trustFolderKey(trust.projectPath);

  if (agent.source.matrixRef === MATRIX["discovery.addDirAgents"]) {
    const accepted = lookupFolderTrust(trust, agentFolder);
    return {
      accepted: accepted === "unknown" ? "unknown" : accepted,
      rule: FACT.R6,
      matrixRef: TRUST_MATRIX_IDS[FACT.R6],
    };
  }

  if (trustFolderKey(agentFolder) !== projectKey) {
    const accepted = lookupFolderTrust(trust, agentFolder);
    return {
      accepted: accepted === "unknown" ? "unknown" : accepted,
      rule: FACT.R2,
      matrixRef: TRUST_MATRIX_IDS[FACT.R2],
    };
  }

  return {
    accepted: trust.accepted,
    rule: defaultRule,
    matrixRef: TRUST_MATRIX_IDS[defaultRule],
  };
}

function unknownResult(
  message: string,
  source: SourceInfo,
  matrixRef: MatrixId,
  rule: TrustRule,
): ResolveTrustResult {
  return {
    status: "unknown",
    gated: false,
    matrixRef,
    reasons: [makeReason("unknown", message, source, rule)],
  };
}

function availableReason(
  agent: Agent,
  kind: TrustGatedKind,
  rule: FactId,
  matrixRef: MatrixId,
  message: string,
): ResolveTrustResult {
  const fieldPath =
    kind === "inline-mcp" ? "frontmatter.mcpServers" : "frontmatter.hooks";
  return {
    status: "available",
    gated: false,
    matrixRef,
    reasons: [
      makeReason("trust", message, fieldSource(agent, fieldPath), rule),
    ],
  };
}

function blockedMessage(kind: TrustGatedKind, rule: TrustRule): string {
  if (rule === FACT.R6) {
    return "Inline MCP server blocked until the --add-dir folder trust is accepted (R6).";
  }
  if (rule === FACT.R2) {
    return kind === "inline-mcp"
      ? "Inline MCP server blocked until the containing folder trust is accepted; parent-folder trust does not count (R2)."
      : "Agent frontmatter hooks blocked until the containing folder trust is accepted; parent-folder trust does not count (R2).";
  }
  return kind === "inline-mcp"
    ? "Inline MCP server blocked until project trust is accepted (R1)."
    : "Agent frontmatter hooks blocked until project trust is accepted (R5).";
}

/**
 * Resolve whether an agent resource is blocked by missing project trust.
 * @see docs/SPEC.md R1, R4, R5, R2, R6, §7.2
 */
export function resolveTrustGate(input: ResolveTrustInput): ResolveTrustResult {
  const { agent, trust, kind, mcpServerEntry, mcpServerIndex } = input;

  if (kind === "inline-mcp") {
    if (mcpServerEntry === undefined) {
      return unknownResult(
        "No MCP server entry provided for inline-mcp trust resolution.",
        agent.source,
        MATRIX["trust.inlineMcp"],
        FACT.R1,
      );
    }

    if (!isInlineMcpServerEntry(mcpServerEntry)) {
      return availableReason(
        agent,
        kind,
        FACT.R4,
        MATRIX["trust.inlineMcp"],
        "Named MCP server reference does not require project trust (R4).",
      );
    }

    if (!isTrustGatedAgent(agent)) {
      return availableReason(
        agent,
        kind,
        FACT.R4,
        MATRIX["trust.inlineMcp"],
        `Inline MCP from ${agent.source.scope} scope loads without project trust (R4).`,
      );
    }
  }

  if (kind === "agent-hooks") {
    if (!hasDeclaredHooks(agent)) {
      return {
        status: "available",
        gated: false,
        matrixRef: MATRIX["trust.frontmatterHooks"],
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
        MATRIX["trust.frontmatterHooks"],
        `Agent hooks from ${agent.source.scope} scope run without project trust (R4).`,
      );
    }
  }

  const fieldPath =
    kind === "inline-mcp"
      ? `frontmatter.mcpServers[${mcpServerIndex ?? 0}]`
      : "frontmatter.hooks";
  const source = fieldSource(agent, fieldPath);
  const { accepted, rule, matrixRef } = resolveTrustRule(agent, trust, kind);

  if (accepted === "unknown") {
    return {
      status: "unknown",
      gated: true,
      matrixRef,
      reasons: [
        makeReason(
          "unknown",
          `Project trust state could not be determined; ${
            kind === "inline-mcp" ? "inline MCP server" : "agent frontmatter hooks"
          } resolution is unknown.${
            trust.unknownReason ? ` ${trust.unknownReason}` : ""
          }`,
          source,
          rule,
        ),
      ],
    };
  }

  if (accepted === true) {
    return {
      status: "available",
      gated: true,
      matrixRef,
      reasons: [
        makeReason(
          "trust",
          "Project trust accepted; resource loads normally.",
          source,
          rule,
        ),
      ],
    };
  }

  return {
    status: "blocked_by_trust",
    gated: true,
    matrixRef,
    reasons: [
      makeReason("trust", blockedMessage(kind, rule), source, rule),
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
    return unknownResult(
      "Source is not an MCP configuration file.",
      source,
      MATRIX["trust.inlineMcp"],
      FACT.R1,
    );
  }

  return {
    status: "available",
    gated: false,
    matrixRef: MATRIX["trust.inlineMcp"],
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
