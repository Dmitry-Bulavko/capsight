/**
 * Cursor version matrix — start minimal; unverified rules resolve unknown.
 * @see docs/CURSOR-FACTS.md §10
 */

import type { Enforcement } from "../../../core/model/index.js";
import type { FactId } from "./facts.js";

export interface FeatureCompatibility {
  id: string;
  feature: string;
  factRefs: readonly FactId[];
  minVersion?: string;
  status: "supported" | "unsupported" | "changed" | "unknown";
  confidence: "doc" | "fixture" | "runtime-observed";
  fixture?: string;
  notes?: string;
}

export type MatrixId = string;

const MATRIX_ENTRIES: FeatureCompatibility[] = [
  {
    id: "agent.toolPool",
    feature: "Subagent declared tools resolve to effective pool",
    factRefs: ["CA4"],
    status: "unknown",
    confidence: "doc",
    notes: "Tool pool semantics not documented for Cursor v1",
  },
  {
    id: "trust.project",
    feature: "Project folder trust gate",
    factRefs: ["CT1"],
    status: "unknown",
    confidence: "doc",
    notes: "No Cursor trust record equivalent documented",
  },
  {
    id: "collision.sameDir",
    feature: "Same-directory agent name collision",
    factRefs: ["CA3", "CW4"],
    status: "unknown",
    confidence: "doc",
    fixture: "basic",
    notes: "Mirror Claude A4 pattern; winner rule unverified",
  },
];

export const VERSION_MATRIX: readonly FeatureCompatibility[] = MATRIX_ENTRIES;

export const MATRIX: Record<string, MatrixId> = Object.fromEntries(
  MATRIX_ENTRIES.map((entry) => [entry.id, entry.id]),
);

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

export function gateDiscovery(matrixRef: MatrixId): { unfounded: boolean; enforcement: Enforcement } {
  const decision = resolveEnforcement(matrixRef);
  return { unfounded: decision.unfounded, enforcement: decision.enforcement };
}
