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
