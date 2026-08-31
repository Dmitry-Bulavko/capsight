import {
  OBSERVED_STATUS_EVIDENCE,
  type ObservedCapability,
  type ObservedEvidenceKind,
  type ObservedStatus,
} from "./types.js";

export type ObservedCapabilityValidationCode =
  | "absence-denied-promotion"
  | "status-evidence-mismatch"
  | "missing-capability-id"
  | "missing-timestamp"
  | "missing-claude-version";

export interface ObservedCapabilityValidationError {
  code: ObservedCapabilityValidationCode;
  message: string;
}

export type NormalizeObservedCapabilityResult =
  | { ok: true; value: ObservedCapability }
  | { ok: false; error: ObservedCapabilityValidationError };

function requiredEvidenceFor(status: ObservedStatus): ObservedEvidenceKind {
  return OBSERVED_STATUS_EVIDENCE[status];
}

function mismatchError(
  observedStatus: ObservedStatus,
  evidenceKind: ObservedEvidenceKind,
): ObservedCapabilityValidationError {
  const required = requiredEvidenceFor(observedStatus);
  if (evidenceKind === "absence" && observedStatus === "denied") {
    return {
      code: "absence-denied-promotion",
      message:
        'observedStatus "denied" cannot use evidenceKind "absence": absence is not evidence of denial (SPEC §9.3)',
    };
  }

  return {
    code: "status-evidence-mismatch",
    message:
      `observedStatus "${observedStatus}" requires evidenceKind "${required}", got "${evidenceKind}"`,
  };
}

/**
 * Validate an observed capability record against §9.3 invariants.
 * Rejects absence→denied promotion and any status/evidenceKind mismatch.
 */
export function normalizeObservedCapability(
  input: ObservedCapability,
): NormalizeObservedCapabilityResult {
  if (input.capabilityId.trim() === "") {
    return {
      ok: false,
      error: {
        code: "missing-capability-id",
        message: "capabilityId is required",
      },
    };
  }

  if (input.claudeVersion.trim() === "") {
    return {
      ok: false,
      error: {
        code: "missing-claude-version",
        message: "claudeVersion is required",
      },
    };
  }

  if (input.timestamp.trim() === "") {
    return {
      ok: false,
      error: {
        code: "missing-timestamp",
        message: "timestamp is required",
      },
    };
  }

  const requiredEvidence = requiredEvidenceFor(input.observedStatus);
  if (input.evidenceKind !== requiredEvidence) {
    return {
      ok: false,
      error: mismatchError(input.observedStatus, input.evidenceKind),
    };
  }

  return { ok: true, value: input };
}

/** Whether a status/evidence pair satisfies §9.3 pairing rules. */
export function isValidObservedEvidencePair(
  observedStatus: ObservedStatus,
  evidenceKind: ObservedEvidenceKind,
): boolean {
  return evidenceKind === requiredEvidenceFor(observedStatus);
}
