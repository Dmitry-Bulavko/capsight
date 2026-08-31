import { describe, expect, it } from "vitest";
import {
  factConfidence as claudeFactConfidence,
  FACT,
  FACTS as CLAUDE_FACTS,
} from "../../src/adapters/claude/version/facts.js";
import { VERSION_MATRIX as CLAUDE_MATRIX } from "../../src/adapters/claude/version/matrix.js";
import {
  factConfidence as codexFactConfidence,
  FACT as CODEX_FACT,
  FACTS as CODEX_FACTS,
} from "../../src/adapters/codex/version/facts.js";
import { VERSION_MATRIX as CODEX_MATRIX } from "../../src/adapters/codex/version/matrix.js";
import {
  factConfidence as cursorFactConfidence,
  FACT as CURSOR_FACT,
  FACTS as CURSOR_FACTS,
} from "../../src/adapters/cursor/version/facts.js";
import { VERSION_MATRIX as CURSOR_MATRIX } from "../../src/adapters/cursor/version/matrix.js";
import {
  buildCoverageReport,
  classifyFactCoverage,
  discoverFixtureNames,
  findStaleLedgerEntries,
  findUnledgeredUnverifiedFacts,
  formatCoverageReport,
  indexEvidenceLedger,
  loadEvidenceLedgerGateIndex,
  loadEvidenceLedgerMeasuredCounts,
  parseEvidenceLedgerGateIndex,
  parseEvidenceLedgerMeasuredCounts,
  platformFixturesRoot,
  PLATFORM_FIXTURE_NAMES,
  type CoverageFact,
  type CoverageMatrixEntry,
  type FactRegistryConfidence,
  type PlatformId,
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

describe("D3-01 env-cluster tier movement", () => {
  const ENV_CLUSTER = [
    FACT.E1,
    FACT.E2,
    FACT.E3,
    FACT.E4,
    FACT.E5,
    FACT.E6,
    FACT.E7,
    FACT.E8,
    FACT.E9,
    FACT.B5,
    FACT.B6,
    FACT.N3,
    FACT.N4,
  ] as const;

  const fixtures = new Set(["environment", "depth-limit"]);

  it("moves env-cluster facts off unverified with honest tiers", () => {
    expect(ENV_CLUSTER).toHaveLength(13);

    expect(
      classifyFactCoverage(FACT.E9, fixtures, CLAUDE_MATRIX, claudeFactConfidence),
    ).toBe("externally-cited");

    for (const id of ENV_CLUSTER) {
      if (id === FACT.E9) {
        continue;
      }
      expect(
        classifyFactCoverage(id, fixtures, CLAUDE_MATRIX, claudeFactConfidence),
      ).toBe("documentation-only");
    }
  });
});

describe("D5-05 environment-cluster promotion gate", () => {
  const ENV_PROMOTION_CLUSTER = [
    FACT.E1,
    FACT.E2,
    FACT.E3,
    FACT.E4,
    FACT.E5,
    FACT.E6,
    FACT.E7,
    FACT.E8,
    FACT.E9,
    FACT.B5,
    FACT.B6,
    FACT.N3,
    FACT.N4,
  ] as const;

  const fixtures = new Set(["environment", "depth-limit"]);

  it("keeps env-cluster facts at honest tiers with zero fv delta after D5-05", () => {
    expect(ENV_PROMOTION_CLUSTER).toHaveLength(13);

    expect(
      classifyFactCoverage(FACT.E9, fixtures, CLAUDE_MATRIX, claudeFactConfidence),
    ).toBe("externally-cited");

    for (const id of ENV_PROMOTION_CLUSTER) {
      if (id === FACT.E9) {
        continue;
      }
      expect(
        classifyFactCoverage(id, fixtures, CLAUDE_MATRIX, claudeFactConfidence),
      ).toBe("documentation-only");
    }
  });
});

describe("D3-02 trust-cluster tier movement", () => {
  const TRUST_CLUSTER = [FACT.R2, FACT.R6] as const;

  const fixtures = new Set(["nested-project", "add-dir"]);

  it("moves trust-cluster facts off unverified with honest tiers", () => {
    expect(TRUST_CLUSTER).toHaveLength(2);

    for (const id of TRUST_CLUSTER) {
      expect(
        classifyFactCoverage(id, fixtures, CLAUDE_MATRIX, claudeFactConfidence),
      ).toBe("documentation-only");
    }
  });
});

describe("D3-03 discovery/builtins-cluster tier movement", () => {
  const fixtures = new Set(["tools-filters", "builtin-agents"]);

  it("moves discovery/builtins-cluster facts off unverified with honest tiers", () => {
    expect(
      classifyFactCoverage(FACT.T5, fixtures, CLAUDE_MATRIX, claudeFactConfidence),
    ).toBe("documentation-only");
    expect(
      classifyFactCoverage(FACT.B1, fixtures, CLAUDE_MATRIX, claudeFactConfidence),
    ).toBe("fixture-verified");
    expect(
      classifyFactCoverage(FACT.B4, fixtures, CLAUDE_MATRIX, claudeFactConfidence),
    ).toBe("documentation-only");
  });
});

describe("D3-04 remaining-facts cluster tier movement", () => {
  const REMAINING_CLUSTER = [
    FACT.P3,
    FACT.K7,
    FACT.K9,
    FACT.I4,
    FACT.N1,
    FACT.M4,
    FACT.M5,
  ] as const;

  const fixtures = new Set(["skill-allowed-tools", "depth-limit"]);

  it("moves remaining-facts-cluster facts off unverified with honest tiers", () => {
    expect(REMAINING_CLUSTER).toHaveLength(7);

    expect(
      classifyFactCoverage(FACT.K7, fixtures, CLAUDE_MATRIX, claudeFactConfidence),
    ).toBe("documentation-only");

    expect(
      classifyFactCoverage(FACT.N1, fixtures, CLAUDE_MATRIX, claudeFactConfidence),
    ).toBe("documentation-only");

    for (const id of [FACT.P3, FACT.K9, FACT.I4, FACT.M4, FACT.M5] as const) {
      expect(
        classifyFactCoverage(id, fixtures, CLAUDE_MATRIX, claudeFactConfidence),
      ).toBe("documentation-only");
    }
  });
});

describe("D4-01 discovery/walk-cluster tier movement", () => {
  const DISCOVERY_WALK_CLUSTER = [
    CURSOR_FACT.CW1,
    CURSOR_FACT.CW2,
    CURSOR_FACT.CW3,
    CURSOR_FACT.CA1,
    CURSOR_FACT.CS1,
  ] as const;

  const fixtures = new Set(["basic"]);

  it("moves discovery/walk-cluster facts off unverified with honest tiers", () => {
    expect(DISCOVERY_WALK_CLUSTER).toHaveLength(5);

    expect(
      classifyFactCoverage(
        CURSOR_FACT.CA1,
        fixtures,
        CURSOR_MATRIX,
        cursorFactConfidence,
      ),
    ).toBe("fixture-verified");

    expect(
      classifyFactCoverage(
        CURSOR_FACT.CS1,
        fixtures,
        CURSOR_MATRIX,
        cursorFactConfidence,
      ),
    ).toBe("fixture-verified");

    expect(
      classifyFactCoverage(
        CURSOR_FACT.CW1,
        fixtures,
        CURSOR_MATRIX,
        cursorFactConfidence,
      ),
    ).toBe("documentation-only");

    expect(
      classifyFactCoverage(
        CURSOR_FACT.CW2,
        fixtures,
        CURSOR_MATRIX,
        cursorFactConfidence,
      ),
    ).toBe("externally-cited");

    expect(
      classifyFactCoverage(
        CURSOR_FACT.CW3,
        fixtures,
        CURSOR_MATRIX,
        cursorFactConfidence,
      ),
    ).toBe("documentation-only");
  });
});

describe("D4-02 rules/settings-cluster tier movement", () => {
  const RULES_SETTINGS_CLUSTER = [
    CURSOR_FACT.CR2,
    CURSOR_FACT.CR3,
    CURSOR_FACT.CSet3,
  ] as const;

  const fixtures = new Set(["basic"]);

  it("moves rules/settings-cluster facts off unverified with honest tiers", () => {
    expect(RULES_SETTINGS_CLUSTER).toHaveLength(3);

    expect(
      classifyFactCoverage(
        CURSOR_FACT.CR2,
        fixtures,
        CURSOR_MATRIX,
        cursorFactConfidence,
      ),
    ).toBe("documentation-only");

    expect(
      classifyFactCoverage(
        CURSOR_FACT.CR3,
        fixtures,
        CURSOR_MATRIX,
        cursorFactConfidence,
      ),
    ).toBe("fixture-verified");

    expect(
      classifyFactCoverage(
        CURSOR_FACT.CSet3,
        fixtures,
        CURSOR_MATRIX,
        cursorFactConfidence,
      ),
    ).toBe("externally-cited");
  });
});

describe("D4-03 version/walk-cluster tier movement", () => {
  const VERSION_WALK_CLUSTER = [
    CODEX_FACT.XV1,
    CODEX_FACT.XV2,
    CODEX_FACT.XV3,
    CODEX_FACT.XR1,
    CODEX_FACT.XR2,
  ] as const;

  const fixtures = new Set([
    "basic",
    "nested-instructions",
    "agents-precedence",
    "trust-untrusted",
  ]);

  it("moves version/walk-cluster facts off unverified with honest tiers", () => {
    expect(VERSION_WALK_CLUSTER).toHaveLength(5);

    expect(
      classifyFactCoverage(
        CODEX_FACT.XV1,
        fixtures,
        CODEX_MATRIX,
        codexFactConfidence,
      ),
    ).toBe("documentation-only");

    expect(
      classifyFactCoverage(
        CODEX_FACT.XV2,
        fixtures,
        CODEX_MATRIX,
        codexFactConfidence,
      ),
    ).toBe("spike-cited");

    expect(
      classifyFactCoverage(
        CODEX_FACT.XV3,
        fixtures,
        CODEX_MATRIX,
        codexFactConfidence,
      ),
    ).toBe("documentation-only");

    expect(
      classifyFactCoverage(
        CODEX_FACT.XR1,
        fixtures,
        CODEX_MATRIX,
        codexFactConfidence,
      ),
    ).toBe("documentation-only");

    expect(
      classifyFactCoverage(
        CODEX_FACT.XR2,
        fixtures,
        CODEX_MATRIX,
        codexFactConfidence,
      ),
    ).toBe("documentation-only");
  });
});

describe("D4-04 instructions/trust-cluster tier movement", () => {
  const INSTRUCTIONS_TRUST_CLUSTER = [
    CODEX_FACT.XI3,
    CODEX_FACT.XI4,
    CODEX_FACT.XA1,
    CODEX_FACT.XT3,
  ] as const;

  const fixtures = new Set([
    "basic",
    "nested-instructions",
    "agents-precedence",
    "trust-untrusted",
    "instruction-fallback",
  ]);

  it("moves instructions/trust-cluster facts off unverified with honest tiers", () => {
    expect(INSTRUCTIONS_TRUST_CLUSTER).toHaveLength(4);

    expect(
      classifyFactCoverage(
        CODEX_FACT.XI3,
        fixtures,
        CODEX_MATRIX,
        codexFactConfidence,
      ),
    ).toBe("fixture-verified");

    expect(
      classifyFactCoverage(
        CODEX_FACT.XI4,
        fixtures,
        CODEX_MATRIX,
        codexFactConfidence,
      ),
    ).toBe("documentation-only");

    expect(
      classifyFactCoverage(
        CODEX_FACT.XA1,
        fixtures,
        CODEX_MATRIX,
        codexFactConfidence,
      ),
    ).toBe("fixture-verified");

    expect(
      classifyFactCoverage(
        CODEX_FACT.XT3,
        fixtures,
        CODEX_MATRIX,
        codexFactConfidence,
      ),
    ).toBe("fixture-verified");
  });
});

describe("D4-05 settings/architecture-cluster tier movement", () => {
  const SETTINGS_ARCHITECTURE_CLUSTER = [CODEX_FACT.XA3, CODEX_FACT.XSet1] as const;

  const fixtures = new Set([
    "basic",
    "nested-instructions",
    "agents-precedence",
    "trust-untrusted",
    "instruction-fallback",
  ]);

  it("moves settings/architecture-cluster facts off unverified with honest tiers", () => {
    expect(SETTINGS_ARCHITECTURE_CLUSTER).toHaveLength(2);

    expect(
      classifyFactCoverage(
        CODEX_FACT.XA3,
        fixtures,
        CODEX_MATRIX,
        codexFactConfidence,
      ),
    ).toBe("externally-cited");

    expect(
      classifyFactCoverage(
        CODEX_FACT.XSet1,
        fixtures,
        CODEX_MATRIX,
        codexFactConfidence,
      ),
    ).toBe("fixture-verified");
  });
});

const D3_UNVERIFIED_CEILING = 45;

function definePlatformCoverage<Id extends string>(coverage: {
  platform: PlatformId;
  facts: readonly CoverageFact<Id>[];
  matrix: readonly CoverageMatrixEntry<NoInfer<Id>>[];
  fixturesRoot: string;
  fixtureNames: readonly string[];
  getFactConfidence: (id: Id) => FactRegistryConfidence;
}) {
  return {
    ...coverage,
    getFactConfidence: (id: string) => coverage.getFactConfidence(id as Id),
  };
}

const PLATFORM_COVERAGE = [
  definePlatformCoverage({
    platform: "claude",
    facts: CLAUDE_FACTS,
    matrix: CLAUDE_MATRIX,
    fixturesRoot: platformFixturesRoot("claude"),
    fixtureNames: PLATFORM_FIXTURE_NAMES.claude,
    getFactConfidence: claudeFactConfidence,
  }),
  definePlatformCoverage({
    platform: "cursor",
    facts: CURSOR_FACTS,
    matrix: CURSOR_MATRIX,
    fixturesRoot: platformFixturesRoot("cursor"),
    fixtureNames: PLATFORM_FIXTURE_NAMES.cursor,
    getFactConfidence: cursorFactConfidence,
  }),
  definePlatformCoverage({
    platform: "codex",
    facts: CODEX_FACTS,
    matrix: CODEX_MATRIX,
    fixturesRoot: platformFixturesRoot("codex"),
    fixtureNames: PLATFORM_FIXTURE_NAMES.codex,
    getFactConfidence: codexFactConfidence,
  }),
];

describe("D3-05 unverified gate", () => {
  it("parses the ledger summary table Current row", () => {
    expect(
      parseEvidenceLedgerMeasuredCounts(`
| | claude | cursor | codex | unverified total |
| Current (this ledger) | 10 | 7 | 1 | **18** |
`),
    ).toEqual({ claude: 10, cursor: 7, codex: 1, total: 18 });
  });

  it("keeps total unverified below 45 (D3 gate)", () => {
    let totalUnverified = 0;

    for (const coverage of PLATFORM_COVERAGE) {
      const fixtures = discoverFixtureNames(
        coverage.fixturesRoot,
        coverage.fixtureNames,
      );
      const report = buildCoverageReport(
        coverage.facts,
        coverage.matrix,
        fixtures,
        coverage.getFactConfidence,
      );
      totalUnverified += report.unverified;
    }

    expect(totalUnverified).toBeLessThan(D3_UNVERIFIED_CEILING);
  });

  it("matches docs/EVIDENCE-LEDGER.md measured counts to buildCoverageReport", () => {
    const ledger = loadEvidenceLedgerMeasuredCounts();
    const ledgerIndex = indexEvidenceLedger(loadEvidenceLedgerGateIndex());
    const gateCountByPlatform = new Map<PlatformId, number>();

    for (const entry of loadEvidenceLedgerGateIndex()) {
      gateCountByPlatform.set(
        entry.platform,
        (gateCountByPlatform.get(entry.platform) ?? 0) + 1,
      );
    }

    let measuredTotal = 0;

    for (const coverage of PLATFORM_COVERAGE) {
      const fixtures = discoverFixtureNames(
        coverage.fixturesRoot,
        coverage.fixtureNames,
      );
      const report = buildCoverageReport(
        coverage.facts,
        coverage.matrix,
        fixtures,
        coverage.getFactConfidence,
      );

      measuredTotal += report.unverified;

      expect(
        report.unverified,
        coverage.platform + ": buildCoverageReport vs ledger summary",
      ).toBe(ledger[coverage.platform]);

      expect(
        report.unverified,
        coverage.platform + ": buildCoverageReport vs Gate index row count",
      ).toBe(gateCountByPlatform.get(coverage.platform));

      expect(
        findUnledgeredUnverifiedFacts(coverage, ledgerIndex),
        coverage.platform + ": unverified facts missing ledger disposition",
      ).toEqual([]);

      expect(
        findStaleLedgerEntries(coverage, ledgerIndex),
        coverage.platform + ": stale Gate index rows",
      ).toEqual([]);
    }

    expect(measuredTotal).toBe(ledger.total);
    expect(measuredTotal).toBeLessThan(D3_UNVERIFIED_CEILING);
  });
});

const D4_UNVERIFIED_CEILING = 18;

describe("D4-06 entry-owed gate", () => {
  it("keeps entry-owed count at zero across all platforms", () => {
    const entryOwed = loadEvidenceLedgerGateIndex().filter(
      (entry) => entry.disposition === "entry-owed",
    );
    expect(entryOwed).toEqual([]);
  });

  it("keeps total unverified at or below 18 (D4 gate)", () => {
    let totalUnverified = 0;

    for (const coverage of PLATFORM_COVERAGE) {
      const fixtures = discoverFixtureNames(
        coverage.fixturesRoot,
        coverage.fixtureNames,
      );
      const report = buildCoverageReport(
        coverage.facts,
        coverage.matrix,
        fixtures,
        coverage.getFactConfidence,
      );
      totalUnverified += report.unverified;
    }

    expect(totalUnverified).toBeLessThanOrEqual(D4_UNVERIFIED_CEILING);
  });

  it("matches docs/EVIDENCE-LEDGER.md measured counts to buildCoverageReport", () => {
    const ledger = loadEvidenceLedgerMeasuredCounts();
    const gateIndex = loadEvidenceLedgerGateIndex();
    const ledgerIndex = indexEvidenceLedger(gateIndex);
    const gateCountByPlatform = new Map<PlatformId, number>();

    for (const entry of gateIndex) {
      gateCountByPlatform.set(
        entry.platform,
        (gateCountByPlatform.get(entry.platform) ?? 0) + 1,
      );
    }

    const entryOwedTotal = gateIndex.filter(
      (entry) => entry.disposition === "entry-owed",
    ).length;

    let measuredTotal = 0;

    for (const coverage of PLATFORM_COVERAGE) {
      const fixtures = discoverFixtureNames(
        coverage.fixturesRoot,
        coverage.fixtureNames,
      );
      const report = buildCoverageReport(
        coverage.facts,
        coverage.matrix,
        fixtures,
        coverage.getFactConfidence,
      );

      measuredTotal += report.unverified;

      expect(
        report.unverified,
        coverage.platform + ": buildCoverageReport vs ledger summary",
      ).toBe(ledger[coverage.platform]);

      expect(
        report.unverified,
        coverage.platform + ": buildCoverageReport vs Gate index row count",
      ).toBe(gateCountByPlatform.get(coverage.platform));

      expect(
        findUnledgeredUnverifiedFacts(coverage, ledgerIndex),
        coverage.platform + ": unverified facts missing ledger disposition",
      ).toEqual([]);

      expect(
        findStaleLedgerEntries(coverage, ledgerIndex),
        coverage.platform + ": stale Gate index rows",
      ).toEqual([]);
    }

    expect(measuredTotal).toBe(ledger.total);
    expect(measuredTotal).toBeLessThanOrEqual(D4_UNVERIFIED_CEILING);
    expect(entryOwedTotal).toBe(0);
  });
});
