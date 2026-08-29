/**
 * Codex version matrix — start minimal; unverified rules resolve unknown.
 * @see docs/CODEX-FACTS.md §11
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
    id: "instruction.chain",
    feature: "AGENTS.md instruction chain application",
    factRefs: ["XI5"],
    status: "unknown",
    confidence: "doc",
    notes: "Merge semantics not fixture-gated in v1",
  },
  {
    id: "trust.project",
    feature: "Project trust gate for .codex/ layers",
    factRefs: ["XT1", "XT2"],
    status: "unknown",
    confidence: "doc",
    notes: "Trust storage format not documented",
  },
  {
    id: "mcp.probe",
    feature: "MCP server runtime availability",
    factRefs: ["XM3"],
    status: "unknown",
    confidence: "doc",
    notes: "Probe requires explicit confirmation",
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
