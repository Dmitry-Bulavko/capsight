import { describe, expect, it } from "vitest";
import type { ExecutionContext } from "../../../src/core/model/index.js";
import {
  OBSERVED_STATUS_EVIDENCE,
  isValidObservedEvidencePair,
  normalizeObservedCapability,
  type ObservedCapability,
} from "../../../src/core/observed/index.js";

const context: ExecutionContext = {
  preset: "main-session",
  isMainSession: true,
  isBackground: false,
  isFork: false,
  isTeammate: false,
  depth: 0,
  maxDepth: 3,
};

function baseRecord(
  overrides: Partial<ObservedCapability> = {},
): ObservedCapability {
  return {
    capabilityId: "Read",
    context,
    observedStatus: "available",
    evidenceKind: "tool-invoked",
    source: "hook",
    confidence: "high",
    claudeVersion: "2.1.219",
    timestamp: "2026-08-31T12:00:00.000Z",
    ...overrides,
  };
}

describe("OBSERVED_STATUS_EVIDENCE", () => {
  it("maps each status to its required evidence kind", () => {
    expect(OBSERVED_STATUS_EVIDENCE.available).toBe("tool-invoked");
    expect(OBSERVED_STATUS_EVIDENCE.denied).toBe("permission-denied");
    expect(OBSERVED_STATUS_EVIDENCE["not-observed"]).toBe("absence");
  });
});

describe("normalizeObservedCapability()", () => {
  it("accepts available with tool-invoked evidence", () => {
    const result = normalizeObservedCapability(
      baseRecord({
        observedStatus: "available",
        evidenceKind: "tool-invoked",
      }),
    );
    expect(result).toEqual({
      ok: true,
      value: baseRecord({
        observedStatus: "available",
        evidenceKind: "tool-invoked",
      }),
    });
  });

  it("accepts not-observed with absence evidence", () => {
    const record = baseRecord({
      observedStatus: "not-observed",
      evidenceKind: "absence",
      confidence: "medium",
    });
    expect(normalizeObservedCapability(record)).toEqual({ ok: true, value: record });
  });

  it("accepts denied with permission-denied evidence", () => {
    const record = baseRecord({
      capabilityId: "Bash",
      observedStatus: "denied",
      evidenceKind: "permission-denied",
      source: "agent-sdk",
    });
    expect(normalizeObservedCapability(record)).toEqual({ ok: true, value: record });
  });

  it("rejects absence→denied promotion (§9.3)", () => {
    const result = normalizeObservedCapability(
      baseRecord({
        observedStatus: "denied",
        evidenceKind: "absence",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("absence-denied-promotion");
      expect(result.error.message).toContain("absence");
      expect(result.error.message).toContain("denied");
    }
  });

  it("rejects available without tool-invoked evidence", () => {
    const result = normalizeObservedCapability(
      baseRecord({
        observedStatus: "available",
        evidenceKind: "permission-denied",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("status-evidence-mismatch");
    }
  });

  it("rejects not-observed without absence evidence", () => {
    const result = normalizeObservedCapability(
      baseRecord({
        observedStatus: "not-observed",
        evidenceKind: "tool-invoked",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("status-evidence-mismatch");
    }
  });

  it("rejects denied without permission-denied evidence", () => {
    const result = normalizeObservedCapability(
      baseRecord({
        observedStatus: "denied",
        evidenceKind: "tool-invoked",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("status-evidence-mismatch");
    }
  });

  it("rejects missing capabilityId", () => {
    const result = normalizeObservedCapability(baseRecord({ capabilityId: "  " }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("missing-capability-id");
    }
  });
});

describe("isValidObservedEvidencePair()", () => {
  it("returns true only for canonical pairings", () => {
    expect(isValidObservedEvidencePair("available", "tool-invoked")).toBe(true);
    expect(isValidObservedEvidencePair("not-observed", "absence")).toBe(true);
    expect(isValidObservedEvidencePair("denied", "permission-denied")).toBe(true);
    expect(isValidObservedEvidencePair("denied", "absence")).toBe(false);
    expect(isValidObservedEvidencePair("available", "absence")).toBe(false);
  });
});
