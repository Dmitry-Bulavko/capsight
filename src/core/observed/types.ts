/**
 * Invocation-only observed capability model (SPEC §9.3).
 * @see docs/S9P-UX-CONTRACT.md
 */

import type { ExecutionContext } from "../model/index.js";

/** Runtime observation outcome for one capability in a session. */
export type ObservedStatus = "available" | "denied" | "not-observed";

/** Evidence kind backing an observed status claim. */
export type ObservedEvidenceKind = "tool-invoked" | "permission-denied" | "absence";

export type ObservedSource = "agent-sdk" | "hook" | "debug-log";

export type ObservedConfidence = "high" | "medium" | "low";

/**
 * One-sided runtime observation for a capability (SPEC §9.3).
 * Absence of invocation is not evidence of prohibition.
 */
export interface ObservedCapability {
  capabilityId: string;
  context: ExecutionContext;
  observedStatus: ObservedStatus;
  /** One-sided: absence does NOT mean denied */
  evidenceKind: ObservedEvidenceKind;
  source: ObservedSource;
  confidence: ObservedConfidence;
  claudeVersion: string;
  timestamp: string;
}

/** Required evidence kind for each observed status (S9P-UX-CONTRACT). */
export const OBSERVED_STATUS_EVIDENCE: Readonly<
  Record<ObservedStatus, ObservedEvidenceKind>
> = {
  available: "tool-invoked",
  denied: "permission-denied",
  "not-observed": "absence",
};
