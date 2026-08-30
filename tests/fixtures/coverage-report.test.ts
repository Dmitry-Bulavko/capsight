import { describe, expect, it } from "vitest";
import {
  buildCoverageReport,
  classifyFactCoverage,
  formatCoverageReport,
  type CoverageMatrixEntry,
  type FactRegistryConfidence,
} from "./coverage-report.js";

type TestFactId = "DOC" | "EXT" | "SPIKE" | "UNKNOWN" | "NONE";

const CONFIDENCE: Record<TestFactId, FactRegistryConfidence> = {
  DOC: "doc",
  EXT: "ext",
  SPIKE: "spike",
  UNKNOWN: "unknown",
  NONE: "doc",
};

function confidence(id: TestFactId): FactRegistryConfidence {
  return CONFIDENCE[id];
}

const matrixEntry = (
  factRefs: TestFactId[],
): CoverageMatrixEntry<TestFactId> => ({
  factRefs,
  confidence: "doc",
});

describe("coverage tier by registry confidence", () => {
  const fixtures = new Set<string>();

  it("classifies matrix-referenced facts by registry confidence", () => {
    const matrix = [matrixEntry(["DOC", "EXT", "SPIKE", "UNKNOWN"])];

    expect(classifyFactCoverage("DOC", fixtures, matrix, confidence)).toBe(
      "documentation-only",
    );
    expect(classifyFactCoverage("EXT", fixtures, matrix, confidence)).toBe(
      "externally-cited",
    );
    expect(classifyFactCoverage("SPIKE", fixtures, matrix, confidence)).toBe(
      "spike-cited",
    );
    expect(classifyFactCoverage("UNKNOWN", fixtures, matrix, confidence)).toBe(
      "matrix-referenced-unknown",
    );
  });

  it("leaves unreferenced facts unverified", () => {
    const matrix = [matrixEntry(["DOC"])];

    expect(classifyFactCoverage("NONE", fixtures, matrix, confidence)).toBe(
      "unverified",
    );
  });

  it("does not downgrade fixture-verified or runtime-observed by registry confidence", () => {
    const facts = [{ id: "EXT" as const }];
    const fixtureVerifiedMatrix = [
      {
        factRefs: ["EXT" as const],
        confidence: "fixture" as const,
        fixture: "probe",
        verifiedFacts: ["EXT" as const],
      },
    ];
    const runtimeMatrix = [
      {
        factRefs: ["EXT" as const],
        confidence: "runtime-observed" as const,
        fixture: "probe",
        verifiedFacts: ["EXT" as const],
      },
    ];

    expect(
      classifyFactCoverage(
        "EXT",
        new Set(["probe"]),
        fixtureVerifiedMatrix,
        confidence,
      ),
    ).toBe("fixture-verified");
    expect(
      classifyFactCoverage(
        "EXT",
        new Set(["probe"]),
        runtimeMatrix,
        confidence,
      ),
    ).toBe("runtime-observed");
  });

  it("buildCoverageReport buckets sum to the fixed denominator", () => {
    const facts = [
      { id: "DOC" as const },
      { id: "EXT" as const },
      { id: "SPIKE" as const },
      { id: "UNKNOWN" as const },
      { id: "NONE" as const },
    ];
    const matrix = [matrixEntry(["DOC", "EXT", "SPIKE", "UNKNOWN"])];

    const report = buildCoverageReport(facts, matrix, [], confidence);

    expect(report).toMatchObject({
      total: 5,
      documentationOnly: 1,
      externallyCited: 1,
      spikeCited: 1,
      matrixReferencedUnknown: 1,
      unverified: 1,
      fixtureVerified: 0,
      runtimeObserved: 0,
    });
    expect(
      report.runtimeObserved +
        report.fixtureVerified +
        report.documentationOnly +
        report.externallyCited +
        report.spikeCited +
        report.matrixReferencedUnknown +
        report.unverified,
    ).toBe(5);
  });

  it("formatCoverageReport lists every trust-level bucket", () => {
    const formatted = formatCoverageReport(
      {
        total: 5,
        runtimeObserved: 0,
        fixtureVerified: 0,
        documentationOnly: 1,
        externallyCited: 1,
        spikeCited: 1,
        matrixReferencedUnknown: 1,
        unverified: 1,
      },
      "claude",
    );

    expect(formatted).toContain("documentation-only");
    expect(formatted).toContain("externally-cited");
    expect(formatted).toContain("spike-cited");
    expect(formatted).toContain("matrix-referenced-unknown");
  });
});
