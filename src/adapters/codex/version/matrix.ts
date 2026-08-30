/**
 * Codex version matrix and verified platform facts.
 *
 * ## When an entry may claim `confidence: "fixture"` (H1-28)
 *
 * `confidence` describes the evidence behind *this entry's own rule*, not
 * behind the CODEX-FACTS facts it cites. An entry may claim `"fixture"` only
 * when a corpus fixture makes every part of that rule the operative cause of a
 * *confident* golden expectation: delete the rule from the resolver and a
 * non-`unknown` value in that fixture's `expected.json` changes. A fixture
 * that merely runs while the rule is present, or that produces only `unknown`
 * for it, is not evidence — an `unknown` claims nothing (§11.3), so an entry
 * whose `status` is `unknown` by construction can never reach `"fixture"`.
 *
 * `verifiedFacts` names the subset of `factRefs` the named fixture exercises
 * *entire*, as the operative cause of a confident golden expectation. Only
 * those facts are counted as fixture evidence by §11.4.
 *
 * @see docs/CODEX-FACTS.md, docs/SPEC.md §8, §11.4
 */

import type { CompatMatrixEntry } from "../../../core/compat/matrix.js";
import { RESOURCE_CLASS } from "../../../core/compat/resource-class.js";
import type { Enforcement, Warning } from "../../../core/model/index.js";
import { FACT, type FactId } from "./facts.js";

export interface FeatureCompatibility {
  id: string;
  feature: string;
  factRefs: readonly FactId[];
  minVersion?: string;
  status: "supported" | "unsupported" | "changed" | "unknown";
  confidence: "doc" | "fixture" | "runtime-observed";
  /**
   * Corpus directory under `tests/fixtures/codex/` whose `expected.json`
   * already exercises this entry.
   */
  fixture?: string;
  /**
   * Corpus directory that still has to cover this entry. Mutually exclusive
   * with `fixture`.
   */
  pendingFixture?: string;
  /**
   * Why no fixture can ever promote this entry (H1-28). Mutually exclusive
   * with `fixture` and `pendingFixture`.
   */
  noFixturePossible?: string;
  /**
   * Subset of `factRefs` the named fixture exercises *entire*. Set (possibly
   * empty) on every entry that names a `fixture` (H1-28).
   */
  verifiedFacts?: readonly FactId[];
  notes?: string;
}

const MATRIX_ENTRIES = [
  {
    id: "instruction.chain",
    feature: "AGENTS.md instruction chain application",
    factRefs: [FACT.XI1, FACT.XI5],
    status: "supported",
    confidence: "fixture",
    fixture: "agents-precedence",
    verifiedFacts: [FACT.XI1],
    notes:
      "XI1 entire: agents-precedence carries AGENTS.override.md alongside AGENTS.md in one " +
      "directory; discovery picks override only. XI5 merge order is referenced by the resolver " +
      "message but is not the operative cause in this fixture. Deletion test (D1-08): with the " +
      "entry unfounded instruction capabilities return unknown in the golden.",
  },
  {
    id: "instruction.ancestors",
    feature: "Ancestor AGENTS.md included in instruction walk",
    factRefs: [FACT.XR4, FACT.XI2],
    status: "supported",
    confidence: "doc",
    fixture: "nested-instructions",
    verifiedFacts: [],
    notes:
      "nested-instructions scans from project/sub with AGENTS.md at repo root and in sub; both " +
      "appear in discovery, consistent with XR4/XI2 documentation. The walk is not matrix-gated " +
      "yet, so unfounding this entry would not change the golden — no fixture-verified claim " +
      "(H1-28). XR4 and XI2 rest on documentation alone in §11.4.",
  },
  {
    id: "trust.project",
    feature: "Project trust gate for .codex/ layers",
    factRefs: [FACT.XT1, FACT.XT2],
    status: "supported",
    confidence: "fixture",
    fixture: "trust-untrusted",
    verifiedFacts: [FACT.XT1],
    notes:
      "XT1 entire: trust-untrusted sets accepted false via fixture env; project .codex/ config " +
      "and MCP are absent from discovery and the golden records an enforced warning that project " +
      "layers are not loaded — per §2.4 wording. XT2 storage format remains unknown " +
      "in production. Deletion test (D1-08): unfounding the entry downgrades the warning enforcement.",
  },
  {
    id: "mcp.probe",
    feature: "MCP server runtime availability",
    factRefs: [FACT.XM3],
    status: "unknown",
    confidence: "doc",
    noFixturePossible:
      "XM3 requires explicit runtime confirmation; the resolver marks every MCP server unknown " +
      "and an unknown claims nothing (§11.3), so no fixture can make this entry the operative " +
      "cause of a confident golden value (H1-28).",
    notes: "Probe requires explicit confirmation",
  },
] as const satisfies readonly FeatureCompatibility[];

const CODEX_PLATFORM = "codex";

/** Cross-platform consumption claims for Codex (EC-01). */
export const COMPAT_MATRIX_ENTRIES = [
  {
    id: "compat.codex.agent-markdown",
    resourceClass: RESOURCE_CLASS.AGENT_MARKDOWN,
    platform: CODEX_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.XA1],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Codex primary agent configuration is instruction-based (AGENTS.md), not markdown agent files (XA1).",
  },
  {
    id: "compat.codex.skill-directory",
    resourceClass: RESOURCE_CLASS.SKILL_DIRECTORY,
    platform: CODEX_PLATFORM,
    support: "supported",
    factRefs: [FACT.XS1],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Codex discovers skills from SKILL.md files under the agents skills directory (XS1).",
  },
  {
    id: "compat.codex.command-markdown",
    resourceClass: RESOURCE_CLASS.COMMAND_MARKDOWN,
    platform: CODEX_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.XA1],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Codex does not document slash-command markdown files; configuration is instruction-based (XA1).",
  },
  {
    id: "compat.codex.instruction-agents-md",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_AGENTS_MD,
    platform: CODEX_PLATFORM,
    support: "supported",
    factRefs: [FACT.XI2],
    confidence: "doc",
    enforcement: "advisory",
    reason: "Codex walks AGENTS.md files from the repository root toward the working directory (XI2).",
  },
  {
    id: "compat.codex.instruction-agents-override-md",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_AGENTS_OVERRIDE_MD,
    platform: CODEX_PLATFORM,
    support: "supported",
    factRefs: [FACT.XI1],
    confidence: "doc",
    enforcement: "advisory",
    reason: "Codex prefers AGENTS.override.md over AGENTS.md in the same directory (XI1).",
  },
  {
    id: "compat.codex.instruction-claude-local-md",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_CLAUDE_LOCAL_MD,
    platform: CODEX_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.XI3],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Codex does not read CLAUDE.local.md by default; only configured fallback filenames apply (XI3).",
  },
  {
    id: "compat.codex.instruction-rule-mdc",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_RULE_MDC,
    platform: CODEX_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.XI2],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Codex does not read Cursor rule (.mdc) files; it loads AGENTS.md chains (XI2).",
  },
  {
    id: "compat.codex.instruction-cursorrules",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_CURSORRULES,
    platform: CODEX_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.XI2],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Codex does not read .cursorrules; it loads AGENTS.md chains (XI2).",
  },
  {
    id: "compat.codex.instruction-fallback-doc",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_FALLBACK_DOC,
    platform: CODEX_PLATFORM,
    support: "supported",
    factRefs: [FACT.XI3],
    confidence: "doc",
    enforcement: "advisory",
    reason: "Codex may load filenames listed in project_doc_fallback_filenames when AGENTS.md is absent (XI3).",
  },
  {
    id: "compat.codex.mcp-json-config",
    resourceClass: RESOURCE_CLASS.MCP_JSON_CONFIG,
    platform: CODEX_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.XM1],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Codex does not read JSON mcp.json configuration; MCP is declared in TOML (XM1).",
  },
  {
    id: "compat.codex.mcp-toml-config",
    resourceClass: RESOURCE_CLASS.MCP_TOML_CONFIG,
    platform: CODEX_PLATFORM,
    support: "supported",
    factRefs: [FACT.XM1],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Codex reads MCP servers from TOML mcp_servers blocks (XM1).",
  },
  {
    id: "compat.codex.mcp-inline-agent",
    resourceClass: RESOURCE_CLASS.MCP_INLINE_AGENT,
    platform: CODEX_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.XA1],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Codex does not read inline MCP declarations in agent frontmatter; configuration is TOML-based (XA1).",
  },
  {
    id: "compat.codex.settings-json",
    resourceClass: RESOURCE_CLASS.SETTINGS_JSON,
    platform: CODEX_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.XSet1],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Codex does not read JSON settings layers; configuration is TOML-based (XSet1).",
  },
  {
    id: "compat.codex.settings-toml",
    resourceClass: RESOURCE_CLASS.SETTINGS_TOML,
    platform: CODEX_PLATFORM,
    support: "supported",
    factRefs: [FACT.XR3],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Codex reads layered config.toml files walking from the repository root toward cwd (XR3).",
  },
] as const satisfies readonly CompatMatrixEntry[];

export const VERSION_MATRIX: readonly FeatureCompatibility[] = MATRIX_ENTRIES;

export type MatrixId = (typeof MATRIX_ENTRIES)[number]["id"];

export const MATRIX = Object.freeze(
  Object.fromEntries(MATRIX_ENTRIES.map((entry) => [entry.id, entry.id])),
) as { readonly [K in MatrixId]: K };

export function isMatrixId(value: string): value is MatrixId {
  return MATRIX_ENTRIES.some((entry) => entry.id === value);
}

export function lookupFeature(id: MatrixId): FeatureCompatibility | undefined {
  return MATRIX_ENTRIES.find((entry) => entry.id === id);
}

export interface EnforcementDecision {
  enforcement: Enforcement;
  unfounded: boolean;
  matrixRef: MatrixId;
}

export function resolveEnforcement(matrixRef: MatrixId): EnforcementDecision {
  const entry = lookupFeature(matrixRef);
  if (!entry || entry.status === "unknown") {
    return { enforcement: "unknown", unfounded: true, matrixRef };
  }
  return { enforcement: "enforced", unfounded: false, matrixRef };
}

export function gateCapability(matrixRef: MatrixId): EnforcementDecision {
  return resolveEnforcement(matrixRef);
}

/**
 * Apply the matrix gate to a `Warning` that asserts platform behaviour.
 * When the matrix does not found the claim the warning becomes undetermined.
 */
export function gateWarning(warning: Warning, matrixRef: MatrixId): Warning {
  const decision = resolveEnforcement(matrixRef);
  return {
    ...warning,
    matrixRef,
    enforcement: decision.enforcement,
  };
}
