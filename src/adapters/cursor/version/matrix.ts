/**
 * Cursor version matrix and verified platform facts.
 *
 * ## When an entry may claim `confidence: "fixture"` (H1-28)
 *
 * `confidence` describes the evidence behind *this entry's own rule*, not
 * behind the CURSOR-FACTS facts it cites. An entry may claim `"fixture"` only
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
 * @see docs/CURSOR-FACTS.md, docs/SPEC.md §8, §11.4
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
   * Corpus directory under `tests/fixtures/cursor/` whose `expected.json`
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
    id: "agent.toolPool",
    feature: "Subagent declared tools resolve to effective pool",
    factRefs: [FACT.CA4],
    status: "unknown",
    confidence: "doc",
    noFixturePossible:
      "CA4 records that subagent tool pool semantics are unknown; the resolver " +
      "returns unknown for every declared tool and an unknown claims nothing " +
      "(§11.3), so no fixture can make this entry the operative cause of a " +
      "confident golden value (H1-28).",
    notes: "Tool pool semantics not documented for Cursor v1",
  },
  {
    id: "trust.project",
    feature: "Project folder trust gate",
    factRefs: [FACT.CT1],
    status: "unknown",
    confidence: "doc",
    noFixturePossible:
      "CT1 records that Cursor has no trust record equivalent; the resolver " +
      "emits an unknown trust warning and never blocks on trust, so every " +
      "value this entry causes is unknown by construction (§11.3).",
    notes: "No Cursor trust record equivalent documented",
  },
  {
    id: "collision.sameDir",
    feature: "Same-directory agent name collision",
    factRefs: [FACT.CA3, FACT.CW4],
    status: "supported",
    confidence: "fixture",
    fixture: "collision-same-dir",
    verifiedFacts: [FACT.CA3],
    notes:
      "CA3 entire: the collision-same-dir fixture declares two agents with the " +
      "same name under one agents root; both resolve ambiguous with collision " +
      "enforcement enforced. CW4 covers cross-scope shadowing and is not " +
      "exercised in this fixture. Deletion test (D1-07): with the collision " +
      "rule removed both agents resolve active and the ambiguous-collision " +
      "warnings leave the golden.",
  },
  {
    id: "rules.fileExtension",
    feature: "Plain .md files in .cursor/rules/ are ignored",
    factRefs: [FACT.CR4],
    status: "supported",
    confidence: "fixture",
    fixture: "ignored-rules",
    verifiedFacts: [FACT.CR4],
    notes:
      "CR4 entire: ignored-rules carries plain ignored.md alongside valid.mdc; " +
      "the golden records a warning with enforcement enforced naming the ignored " +
      "file. Deletion test (D1-07): with the rule removed the warning leaves " +
      "the golden and only the .mdc rule is discovered.",
  },
  {
    id: "agent.invalid",
    feature: "Invalid agents missing name or description",
    factRefs: [FACT.CA2],
    status: "supported",
    confidence: "fixture",
    fixture: "invalid-agents",
    verifiedFacts: [FACT.CA2],
    notes:
      "CA2 entire: invalid-agents carries missing-name and missing-description " +
      "agents; the golden records both as status invalid with the specific " +
      "reasons. Deletion test (D1-07): with the validation removed those agents " +
      "resolve active in the golden.",
  },
] as const satisfies readonly FeatureCompatibility[];

const CURSOR_PLATFORM = "cursor";

/** Cross-platform consumption claims for Cursor (EC-01). */
export const COMPAT_MATRIX_ENTRIES = [
  {
    id: "compat.cursor.agent-markdown",
    resourceClass: RESOURCE_CLASS.AGENT_MARKDOWN,
    platform: CURSOR_PLATFORM,
    support: "supported",
    factRefs: [FACT.CA1],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Cursor discovers subagents from markdown files under the agents directory (CA1).",
  },
  {
    id: "compat.cursor.skill-directory",
    resourceClass: RESOURCE_CLASS.SKILL_DIRECTORY,
    platform: CURSOR_PLATFORM,
    support: "supported",
    factRefs: [FACT.CS1],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Cursor discovers skills from SKILL.md files in skill subdirectories (CS1).",
  },
  {
    id: "compat.cursor.command-markdown",
    resourceClass: RESOURCE_CLASS.COMMAND_MARKDOWN,
    platform: CURSOR_PLATFORM,
    support: "supported",
    factRefs: [FACT.CS3],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Cursor discovers slash commands from markdown files under the commands directory (CS3).",
  },
  {
    id: "compat.cursor.instruction-agents-md",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_AGENTS_MD,
    platform: CURSOR_PLATFORM,
    support: "supported",
    factRefs: [FACT.CW3],
    confidence: "doc",
    enforcement: "advisory",
    reason: "Cursor reads AGENTS.md at the project root and in nested subdirectories (CW3).",
  },
  {
    id: "compat.cursor.instruction-claude-md",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_CLAUDE_MD,
    platform: CURSOR_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.CR3],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Cursor does not read CLAUDE.md; it loads AGENTS.md and project rules (CR3).",
  },
  {
    id: "compat.cursor.instruction-claude-local-md",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_CLAUDE_LOCAL_MD,
    platform: CURSOR_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.CR3],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Cursor does not read CLAUDE.local.md; it loads AGENTS.md and project rules (CR3).",
  },
  {
    id: "compat.cursor.instruction-rule-mdc",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_RULE_MDC,
    platform: CURSOR_PLATFORM,
    support: "supported",
    factRefs: [FACT.CR1, FACT.CR4],
    confidence: "doc",
    enforcement: "advisory",
    reason: "Cursor reads .mdc rule files under the rules directory (CR1, CR4).",
  },
  {
    id: "compat.cursor.instruction-cursorrules",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_CURSORRULES,
    platform: CURSOR_PLATFORM,
    support: "supported",
    factRefs: [FACT.CR3],
    confidence: "doc",
    enforcement: "advisory",
    reason: "Cursor still reads the legacy .cursorrules file at the repository root.",
  },
  {
    id: "compat.cursor.instruction-fallback-doc",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_FALLBACK_DOC,
    platform: CURSOR_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.CR3],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Cursor does not use Codex-style project_doc_fallback_filenames; it loads AGENTS.md and rules (CR3).",
  },
  {
    id: "compat.cursor.mcp-json-config",
    resourceClass: RESOURCE_CLASS.MCP_JSON_CONFIG,
    platform: CURSOR_PLATFORM,
    support: "supported",
    factRefs: [FACT.CM1],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Cursor reads MCP servers declared in project mcp.json configuration (CM1).",
  },
  {
    id: "compat.cursor.mcp-toml-config",
    resourceClass: RESOURCE_CLASS.MCP_TOML_CONFIG,
    platform: CURSOR_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.CM1],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Cursor does not read Codex TOML mcp_servers blocks; it uses JSON MCP configuration (CM1).",
  },
  {
    id: "compat.cursor.settings-json",
    resourceClass: RESOURCE_CLASS.SETTINGS_JSON,
    platform: CURSOR_PLATFORM,
    support: "supported",
    factRefs: [FACT.CSet3],
    confidence: "doc",
    enforcement: "unknown",
    reason: "Cursor may expose readable JSON settings layers where install paths are stable (CSet3).",
  },
  {
    id: "compat.cursor.settings-toml",
    resourceClass: RESOURCE_CLASS.SETTINGS_TOML,
    platform: CURSOR_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.CSet1],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Cursor does not read Codex TOML config files; it uses JSON settings (CSet1).",
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

export function gateCollision(matrixRef: MatrixId): EnforcementDecision {
  return resolveEnforcement(matrixRef);
}

export interface DiscoveryGate {
  enforcement: Enforcement;
  unfounded: boolean;
}

export function gateDiscovery(matrixRef: MatrixId): DiscoveryGate {
  const decision = resolveEnforcement(matrixRef);
  return {
    enforcement: decision.enforcement,
    unfounded: decision.unfounded,
  };
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
