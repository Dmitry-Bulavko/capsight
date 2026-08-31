import { describe, expect, it } from "vitest";
import {
  buildCoverageReport,
  classifyFactCoverage,
  findStaleLedgerEntries,
  findUnledgeredUnverifiedFacts,
  formatCoverageReport,
  indexEvidenceLedger,
  parseEvidenceLedgerGateIndex,
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

describe("evidence ledger gate index", () => {
  const sampleMarkdown = `
## Gate index

\`\`\`
claude:T4:out-of-scope
claude:T6:noFixturePossible
cursor:CT2:out-of-scope
codex:XS2:noFixturePossible
\`\`\`
`;

  it("parses platform:factId:disposition lines", () => {
    expect(parseEvidenceLedgerGateIndex(sampleMarkdown)).toEqual([
      { platform: "claude", factId: "T4", disposition: "out-of-scope" },
      { platform: "claude", factId: "T6", disposition: "noFixturePossible" },
      { platform: "cursor", factId: "CT2", disposition: "out-of-scope" },
      { platform: "codex", factId: "XS2", disposition: "noFixturePossible" },
    ]);
  });

  it("flags unverified facts that lack a ledger disposition", () => {
    const coverage = {
      platform: "claude" as const,
      facts: [{ id: "T4" }, { id: "T5" }],
      matrix: [{ factRefs: ["DOC" as const], confidence: "doc" as const }],
    };
    const ledgerIndex = indexEvidenceLedger(
      parseEvidenceLedgerGateIndex(sampleMarkdown),
    );

    expect(findUnledgeredUnverifiedFacts(coverage, ledgerIndex)).toEqual([
      "T5",
    ]);
    expect(findStaleLedgerEntries(coverage, ledgerIndex)).toEqual([]);
  });

  it("flags ledger rows for facts that became matrix-referenced", () => {
    const coverage = {
      platform: "claude" as const,
      facts: [{ id: "T4" }, { id: "T5" }],
      matrix: [{ factRefs: ["T4"], confidence: "doc" as const }],
    };
    const ledgerIndex = indexEvidenceLedger(
      parseEvidenceLedgerGateIndex(sampleMarkdown),
    );

    expect(findUnledgeredUnverifiedFacts(coverage, ledgerIndex)).toEqual([
      "T5",
    ]);
    expect(findStaleLedgerEntries(coverage, ledgerIndex)).toEqual(["T4"]);
  });
});
