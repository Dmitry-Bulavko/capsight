import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ResolvedCapability } from "../../src/core/model/index.js";
import type {
  NormalizedGoldenOutput,
  NormalizedResolution,
} from "./golden-normalize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Platforms that own a fact registry, a matrix and a fixture corpus. */
export const PLATFORM_IDS = ["claude", "cursor", "codex"] as const;

/** Ecosystem cross-platform fixture corpus (SPEC §11.1 extension, EC-08). */
export const ECOSYSTEM_FIXTURE_NAMES = ["mixed"] as const;

export type PlatformId = (typeof PLATFORM_IDS)[number];

/** Fixture corpus directory for one platform, e.g. `tests/fixtures/cursor`. */
export function platformFixturesRoot(platform: PlatformId): string {
  return path.join(__dirname, platform);
}

/** Cross-platform ecosystem fixture corpus at `tests/fixtures/ecosystem`. */
export function ecosystemFixturesRoot(): string {
  return path.join(__dirname, "ecosystem");
}

/**
 * The shape §11.4 needs from a platform's `facts.ts`. Structural, and generic
 * over the platform's own `FactId` union, so the three registries stay type
 * distinct instead of collapsing into `string`.
 */
export interface CoverageFact<Id extends string = string> {
  readonly id: Id;
}

/** The shape §11.4 needs from a platform's `matrix.ts`. */
export interface CoverageMatrixEntry<Id extends string = string> {
  readonly factRefs: readonly Id[];
  readonly confidence: "doc" | "fixture" | "runtime-observed";
  readonly fixture?: string;
  readonly verifiedFacts?: readonly Id[];
}

/** Trust level from a platform's `facts.ts` registry (SPEC §0.1.1). */
export type FactRegistryConfidence = "doc" | "ext" | "spike" | "unknown";

export type CoverageTier =
  | "runtime-observed"
  | "fixture-verified"
  | "documentation-only"
  | "externally-cited"
  | "spike-cited"
  | "matrix-referenced-unknown"
  | "unverified";

export interface CoverageReport {
  /** Fixed denominator: every §3 fact registered in `facts.ts` (SPEC §11.4). */
  total: number;
  runtimeObserved: number;
  fixtureVerified: number;
  documentationOnly: number;
  externallyCited: number;
  spikeCited: number;
  matrixReferencedUnknown: number;
  unverified: number;
}

export interface CapabilityMismatch {
  kind: "capability-mismatch";
  fixtureName: string;
  agentName: string;
  capabilityId: string;
  actualStatus: ResolvedCapability["status"];
  expectedStatus: ResolvedCapability["status"] | undefined;
  actualEnforcement: ResolvedCapability["enforcement"];
  expectedEnforcement: ResolvedCapability["enforcement"] | undefined;
}

export interface MissingResolutionMismatch {
  kind: "missing-resolution";
  fixtureName: string;
  agentName: string;
  resolutionKey: string;
}

export type GateMismatch = CapabilityMismatch | MissingResolutionMismatch;

/** Files SPEC §11.2 requires in every fixture directory. */
export const FIXTURE_REQUIRED_ENTRIES = [
  "project",
  "env.json",
  "version.txt",
  "contexts.json",
  "expected.json",
] as const;

export type FixtureRequiredEntry = (typeof FIXTURE_REQUIRED_ENTRIES)[number];

/**
 * Directory the scan starts from for a fixture. Optional `cwd.txt` names a
 * path inside `project/` so a fixture can exercise the upward walk from cwd
 * (SPEC A2/A3); without it the scan starts at `project/` itself. Golden output
 * stays normalized against `project/` either way, so paths remain relative.
 */
export function resolveFixtureScanPath(fixtureDir: string): string {
  const projectRoot = path.join(fixtureDir, "project");
  const cwdFile = path.join(fixtureDir, "cwd.txt");
  if (!fs.existsSync(cwdFile)) {
    return projectRoot;
  }
  const relative = fs.readFileSync(cwdFile, "utf8").trim();
  return relative === "" ? projectRoot : path.join(projectRoot, relative);
}

/**
 * Directories the fixture passes to `scan({ addDirs })`. Optional
 * `add-dirs.json` holds paths relative to the fixture directory, so an
 * `--add-dir` fixture (A9, K12) can attach a directory the upward scope walk
 * never reaches. Absent file means no additional directories.
 */
export function resolveFixtureAddDirs(fixtureDir: string): string[] {
  const addDirsFile = path.join(fixtureDir, "add-dirs.json");
  if (!fs.existsSync(addDirsFile)) {
    return [];
  }
  const parsed = JSON.parse(fs.readFileSync(addDirsFile, "utf8")) as string[];
  return parsed.map((entry) => path.join(fixtureDir, entry));
}

/**
 * Plugin roots the fixture passes to `scan({ pluginRoots })`. Optional
 * `plugin-roots.json` holds paths relative to the fixture directory: SPEC §3
 * establishes no install location for plugins, so the fixture names its own
 * plugin directories instead of a run depending on what is installed on the
 * machine (§13 invariant 2, H1-22).
 */
export function resolveFixturePluginRoots(fixtureDir: string): string[] {
  const pluginRootsFile = path.join(fixtureDir, "plugin-roots.json");
  if (!fs.existsSync(pluginRootsFile)) {
    return [];
  }
  const parsed = JSON.parse(fs.readFileSync(pluginRootsFile, "utf8")) as string[];
  return parsed.map((entry) => path.join(fixtureDir, entry));
}

/** Managed bundle a §7.8 simulation fixture overlays, when it declares one. */
export function resolveFixtureManagedBundle(
  fixtureDir: string,
): string | undefined {
  const bundlePath = path.join(fixtureDir, "managed-bundle");
  return fs.existsSync(bundlePath) ? bundlePath : undefined;
}

/** The SPEC §11.1 Claude corpus, declared so a dropped fixture stays visible. */
export const CLAUDE_FIXTURE_NAMES = [
  "add-dir",
  "background",
  "basic",
  "builtin-agents",

  "collision-nested",
  "collision-same-dir",
  "depth-limit",
  "environment",
  "fork",
  "instructions",
  "invalid-agents",
  "managed-simulation",
  "nested-project",
  "permission-inheritance",
  "plugin-agents",
  "settings-permissions",
  "skill-allowed-tools",
  "skills-preload",
  "tools-filters",
  "trust-inline-mcp",
  "version-drift",
] as const;

/** Corpus each platform declares. Cursor and Codex carry one fixture each (MP). */
export const PLATFORM_FIXTURE_NAMES = {
  claude: CLAUDE_FIXTURE_NAMES,
  cursor: ["basic", "collision-same-dir", "ignored-rules", "invalid-agents", "version-drift"],
  codex: [
    "basic",
    "agents-precedence",
    "nested-instructions",
    "trust-untrusted",
    "instruction-fallback",
    "version-drift",
  ],
} as const satisfies Record<PlatformId, readonly string[]>;

export type FixtureCompleteness = "complete" | "incomplete" | "empty" | "missing";

export interface FixtureStatus {
  name: string;
  completeness: FixtureCompleteness;
  missingEntries: FixtureRequiredEntry[];
}

const COVERAGE_RANK: Record<CoverageTier, number> = {
  unverified: 0,
  "documentation-only": 1,
  "externally-cited": 1,
  "spike-cited": 1,
  "matrix-referenced-unknown": 1,
  "fixture-verified": 2,
  "runtime-observed": 3,
};

/**
 * Matrix-referenced facts that lack fixture or runtime evidence are split by
 * the cited fact's own registry confidence (D1-13): `documentation-only`
 * reserved for `[doc]` facts; `[ext]` and `[spike]` get honestly named tiers.
 */
function refineMatrixReferencedTier<Id extends string>(
  factId: Id,
  getFactConfidence: (id: Id) => FactRegistryConfidence,
): Exclude<
  CoverageTier,
  "runtime-observed" | "fixture-verified" | "unverified"
> {
  switch (getFactConfidence(factId)) {
    case "doc":
      return "documentation-only";
    case "ext":
      return "externally-cited";
    case "spike":
      return "spike-cited";
    case "unknown":
      return "matrix-referenced-unknown";
  }
}

export function resolutionKey(resolution: NormalizedResolution): string {
  const { agentName, context } = resolution;
  return JSON.stringify({
    agentName,
    preset: context.preset,
    isMainSession: context.isMainSession,
    isBackground: context.isBackground,
    isFork: context.isFork,
    isTeammate: context.isTeammate,
    depth: context.depth,
    maxDepth: context.maxDepth,
    parentPermissionMode: context.parentPermissionMode ?? null,
  });
}

/**
 * A capability claim is confident only when both axes are (SPEC §11.3). A
 * status of `unknown` claims nothing, and a claim carrying
 * `enforcement: "unknown"` is one the product itself disowns — the gate must
 * not hold the product to it (H1-17).
 */
export function isConfidentCapabilityStatus(
  capability: Pick<ResolvedCapability, "status" | "enforcement">,
): boolean {
  return capability.status !== "unknown" && capability.enforcement !== "unknown";
}

/**
 * Returns mismatches where actual output makes a confident capability claim
 * that differs from the golden expectation. An actual `unknown` on either axis
 * is not a confident claim and never fails.
 */
export function findConfidentCapabilityMismatches(
  actual: NormalizedGoldenOutput,
  expected: NormalizedGoldenOutput,
  fixtureName: string,
): GateMismatch[] {
  const mismatches: GateMismatch[] = [];

  const actualByKey = new Map(
    actual.resolutions.map((entry) => [resolutionKey(entry), entry]),
  );

  for (const expectedResolution of expected.resolutions) {
    const key = resolutionKey(expectedResolution);
    const actualResolution = actualByKey.get(key);
    if (!actualResolution) {
      mismatches.push({
        kind: "missing-resolution",
        fixtureName,
        agentName: expectedResolution.agentName,
        resolutionKey: key,
      });
      continue;
    }

    const expectedById = new Map(
      expectedResolution.capabilities.map((capability) => [
        capability.capabilityId,
        capability,
      ]),
    );

    for (const actualCapability of actualResolution.capabilities) {
      if (!isConfidentCapabilityStatus(actualCapability)) {
        continue;
      }

      const expectedCapability = expectedById.get(actualCapability.capabilityId);
      const statusDiffers =
        !expectedCapability ||
        actualCapability.status !== expectedCapability.status;
      // `unknown` enforcement never reaches here: the confidence guard above
      // already skipped it, so it can never block (§11.3).
      const enforcementDiffers =
        !expectedCapability ||
        actualCapability.enforcement !== expectedCapability.enforcement;

      if (statusDiffers || enforcementDiffers) {
        mismatches.push({
          kind: "capability-mismatch",
          fixtureName,
          agentName: expectedResolution.agentName,
          capabilityId: actualCapability.capabilityId,
          actualStatus: actualCapability.status,
          expectedStatus: expectedCapability?.status,
          actualEnforcement: actualCapability.enforcement,
          expectedEnforcement: expectedCapability?.enforcement,
        });
      }
    }
  }

  return mismatches;
}

/** Classifies one §11.1 fixture directory against the §11.2 contract. */
export function inspectFixture(
  fixtureName: string,
  fixturesRoot: string,
): FixtureStatus {
  const fixtureDir = path.join(fixturesRoot, fixtureName);
  if (!fs.existsSync(fixtureDir)) {
    return {
      name: fixtureName,
      completeness: "missing",
      missingEntries: [...FIXTURE_REQUIRED_ENTRIES],
    };
  }

  const missingEntries = FIXTURE_REQUIRED_ENTRIES.filter(
    (entry) => !fs.existsSync(path.join(fixtureDir, entry)),
  );

  if (missingEntries.length === 0) {
    return { name: fixtureName, completeness: "complete", missingEntries: [] };
  }
  if (missingEntries.length === FIXTURE_REQUIRED_ENTRIES.length) {
    return { name: fixtureName, completeness: "empty", missingEntries };
  }
  return { name: fixtureName, completeness: "incomplete", missingEntries };
}

/** Classifies the whole declared §11.1 corpus, in declaration order. */
export function inspectFixtureCorpus(
  fixturesRoot: string,
  fixtureNames: readonly string[],
): FixtureStatus[] {
  return fixtureNames.map((name) => inspectFixture(name, fixturesRoot));
}

/** Directories present on disk that are not part of the declared §11.1 corpus. */
export function findUndeclaredFixtureDirectories(
  fixturesRoot: string,
  fixtureNames: readonly string[],
): string[] {
  const declared = new Set<string>(fixtureNames);
  return fs
    .readdirSync(fixturesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !declared.has(name))
    .sort();
}

/** Fixtures that are not yet runnable: anything not `complete`. */
export function pendingFixtureNames(
  fixturesRoot: string,
  fixtureNames: readonly string[],
): string[] {
  return inspectFixtureCorpus(fixturesRoot, fixtureNames)
    .filter((status) => status.completeness !== "complete")
    .map((status) => status.name)
    .sort();
}

export function formatPendingFixtures(statuses: readonly FixtureStatus[]): string {
  const pending = statuses.filter((status) => status.completeness !== "complete");
  const lines = [
    "pending fixtures (SPEC §11.1): " +
      pending.length +
      " of " +
      statuses.length,
  ];
  for (const status of pending) {
    lines.push(
      "  - " +
        status.name +
        " [" +
        status.completeness +
        "] missing: " +
        status.missingEntries.join(", "),
    );
  }
  return lines.join("\n");
}

/** Fixtures that satisfy the §11.2 contract and can therefore be executed. */
export function discoverFixtureNames(
  fixturesRoot: string,
  fixtureNames: readonly string[],
): string[] {
  return inspectFixtureCorpus(fixturesRoot, fixtureNames)
    .filter((status) => status.completeness === "complete")
    .map((status) => status.name)
    .sort();
}

/**
 * Evidence one matrix entry contributes **for one fact** it references.
 *
 * Three conditions, all necessary (SPEC §11.4, §0.1.3, matrix.ts header):
 * the named fixture exists on disk; the entry's own `confidence` was raised
 * above `doc`; and the entry lists *this fact* in `verifiedFacts`, meaning the
 * fixture exercises the fact entire rather than one edge of it. The third is
 * what keeps the numerator from being talked upward: an entry that pins one
 * rank of A1 or one layer of S1 is fixture-backed for its own verdict and
 * contributes `documentation-only` for the fact.
 *
 * `verifiedFacts` is intersected with `factRefs`, so an entry cannot claim
 * evidence for a fact it does not even reference.
 */
function entryFactCoverageTier<Id extends string>(
  entry: CoverageMatrixEntry<Id>,
  factId: Id,
  availableFixtures: ReadonlySet<string>,
): CoverageTier {
  const hasFixture =
    entry.fixture !== undefined && availableFixtures.has(entry.fixture);
  if (!hasFixture) {
    return "documentation-only";
  }
  if (!entry.factRefs.includes(factId)) {
    return "documentation-only";
  }
  if (!entry.verifiedFacts?.includes(factId)) {
    return "documentation-only";
  }
  if (entry.confidence === "runtime-observed") {
    return "runtime-observed";
  }
  if (entry.confidence === "fixture") {
    return "fixture-verified";
  }
  return "documentation-only";
}

/**
 * Best evidence tier any matrix entry provides for a §3 fact. A fact no matrix
 * entry references is `unverified` — the implementation cannot make it vanish
 * from the denominator by not registering it.
 */
export function classifyFactCoverage<Id extends string>(
  factId: Id,
  availableFixtures: ReadonlySet<string>,
  matrix: readonly CoverageMatrixEntry<Id>[],
  getFactConfidence: (id: Id) => FactRegistryConfidence,
): CoverageTier {
  let tier: CoverageTier = "unverified";

  for (const entry of matrix) {
    if (!entry.factRefs.includes(factId)) {
      continue;
    }
    const candidate = entryFactCoverageTier(entry, factId, availableFixtures);
    if (COVERAGE_RANK[candidate] > COVERAGE_RANK[tier]) {
      tier = candidate;
    }
  }

  if (tier === "documentation-only") {
    return refineMatrixReferencedTier(factId, getFactConfidence);
  }

  return tier;
}

/**
 * Coverage counts over one platform's fixed fact corpus (SPEC §11.4). The
 * denominator is that platform's whole registry in `facts.ts`, never the subset
 * the implementation happens to reference.
 *
 * One report per platform, never a sum: the three registries name different
 * facts, so a combined figure would measure nothing and would improve whenever
 * a corpus shrank.
 *
 * CI diagnostic only: this number is a property of the test suite, not of the
 * scanned project, and must never reach a route or a UI component
 * (SPEC §13 invariant 13). The user-facing number is
 * `EffectiveConfiguration.unknownRate`.
 */
export function buildCoverageReport<Id extends string>(
  facts: readonly CoverageFact<Id>[],
  matrix: readonly CoverageMatrixEntry<Id>[],
  availableFixtures: readonly string[],
  getFactConfidence: (id: Id) => FactRegistryConfidence,
): CoverageReport {
  const fixtureSet = new Set(availableFixtures);

  let runtimeObserved = 0;
  let fixtureVerified = 0;
  let documentationOnly = 0;
  let externallyCited = 0;
  let spikeCited = 0;
  let matrixReferencedUnknown = 0;
  let unverified = 0;

  for (const fact of facts) {
    switch (
      classifyFactCoverage(fact.id, fixtureSet, matrix, getFactConfidence)
    ) {
      case "runtime-observed":
        runtimeObserved += 1;
        break;
      case "fixture-verified":
        fixtureVerified += 1;
        break;
      case "documentation-only":
        documentationOnly += 1;
        break;
      case "externally-cited":
        externallyCited += 1;
        break;
      case "spike-cited":
        spikeCited += 1;
        break;
      case "matrix-referenced-unknown":
        matrixReferencedUnknown += 1;
        break;
      case "unverified":
        unverified += 1;
        break;
    }
  }

  return {
    total: facts.length,
    runtimeObserved,
    fixtureVerified,
    documentationOnly,
    externallyCited,
    spikeCited,
    matrixReferencedUnknown,
    unverified,
  };
}

const COVERAGE_REPORT_LABEL_WIDTH = 26;

function coverageReportLine(label: string, value: number | string): string {
  return label.padEnd(COVERAGE_REPORT_LABEL_WIDTH) + ": " + value;
}

/** Counts every tier a matrix entry references (any evidence level). */
export function matrixReferencedCount(report: CoverageReport): number {
  return (
    report.runtimeObserved +
    report.fixtureVerified +
    report.documentationOnly +
    report.externallyCited +
    report.spikeCited +
    report.matrixReferencedUnknown
  );
}

export function formatCoverageReport(
  report: CoverageReport,
  platform: PlatformId,
): string {
  return [
    coverageReportLine("platform", platform),
    coverageReportLine("SPEC §3 facts", report.total),
    coverageReportLine("runtime-observed", report.runtimeObserved),
    coverageReportLine("fixture-verified", report.fixtureVerified),
    coverageReportLine("documentation-only", report.documentationOnly),
    coverageReportLine("externally-cited", report.externallyCited),
    coverageReportLine("spike-cited", report.spikeCited),
    coverageReportLine("matrix-referenced-unknown", report.matrixReferencedUnknown),
    coverageReportLine("unverified", report.unverified),
  ].join("\n");
}

/** Terminal dispositions in `docs/EVIDENCE-LEDGER.md` Gate index (D2-06). */
export const EVIDENCE_LEDGER_DISPOSITIONS = [
  "entry-owed",
  "noFixturePossible",
  "out-of-scope",
] as const;

export type EvidenceLedgerDisposition =
  (typeof EVIDENCE_LEDGER_DISPOSITIONS)[number];

export interface EvidenceLedgerEntry {
  platform: PlatformId;
  factId: string;
  disposition: EvidenceLedgerDisposition;
}

const EVIDENCE_LEDGER_PATH = path.join(
  __dirname,
  "../../docs/EVIDENCE-LEDGER.md",
);

function ledgerKey(platform: PlatformId, factId: string): string {
  return `${platform}:${factId}`;
}

/**
 * Parses the `## Gate index` fenced block from `docs/EVIDENCE-LEDGER.md`.
 * Each line is `platform:factId:disposition`.
 */
export function parseEvidenceLedgerGateIndex(
  markdown: string,
): EvidenceLedgerEntry[] {
  const gateIndexHeader = "## Gate index";
  const start = markdown.indexOf(gateIndexHeader);
  if (start === -1) {
    throw new Error("EVIDENCE-LEDGER.md missing ## Gate index section");
  }

  const afterHeader = markdown.slice(start);
  const codeFenceStart = afterHeader.indexOf("```");
  if (codeFenceStart === -1) {
    throw new Error("EVIDENCE-LEDGER.md Gate index missing fenced block");
  }

  const contentStart = codeFenceStart + "```".length;
  const blockStart = afterHeader.indexOf("\n", contentStart) + 1;
  const fenceEnd = afterHeader.indexOf("```", blockStart);
  if (fenceEnd === -1) {
    throw new Error("EVIDENCE-LEDGER.md Gate index fenced block not closed");
  }

  const entries: EvidenceLedgerEntry[] = [];
  for (const line of afterHeader.slice(blockStart, fenceEnd).split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") {
      continue;
    }

    const parts = trimmed.split(":");
    if (parts.length !== 3) {
      throw new Error(`Invalid gate index line: ${trimmed}`);
    }

    const [platform, factId, disposition] = parts as [
      string,
      string,
      string,
    ];

    if (!PLATFORM_IDS.includes(platform as PlatformId)) {
      throw new Error(`Unknown platform in gate index: ${platform}`);
    }
    if (
      !EVIDENCE_LEDGER_DISPOSITIONS.includes(
        disposition as EvidenceLedgerDisposition,
      )
    ) {
      throw new Error(`Invalid disposition in gate index: ${disposition}`);
    }

    entries.push({
      platform: platform as PlatformId,
      factId,
      disposition: disposition as EvidenceLedgerDisposition,
    });
  }

  return entries;
}

/** Reads and parses the Gate index from the repo evidence ledger. */
export function loadEvidenceLedgerGateIndex(
  ledgerPath: string = EVIDENCE_LEDGER_PATH,
): EvidenceLedgerEntry[] {
  return parseEvidenceLedgerGateIndex(fs.readFileSync(ledgerPath, "utf8"));
}

/** Per-platform unverified counts from the ledger summary table (D3-05). */
export interface EvidenceLedgerMeasuredCounts {
  claude: number;
  cursor: number;
  codex: number;
  total: number;
}

/** Parses the `Current (this ledger)` row in `docs/EVIDENCE-LEDGER.md`. */
export function parseEvidenceLedgerMeasuredCounts(
  markdown: string,
): EvidenceLedgerMeasuredCounts {
  const match = markdown.match(
    /\|\s*Current \(this ledger\)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*\*\*(\d+)\*\*\s*\|/,
  );
  if (!match) {
    throw new Error(
      "Could not parse Current (this ledger) row in EVIDENCE-LEDGER.md",
    );
  }

  const claude = Number(match[1]);
  const cursor = Number(match[2]);
  const codex = Number(match[3]);
  const total = Number(match[4]);

  return { claude, cursor, codex, total };
}

/** Reads measured unverified counts from the ledger summary table. */
export function loadEvidenceLedgerMeasuredCounts(
  ledgerPath: string = EVIDENCE_LEDGER_PATH,
): EvidenceLedgerMeasuredCounts {
  return parseEvidenceLedgerMeasuredCounts(fs.readFileSync(ledgerPath, "utf8"));
}

/** Maps `platform:factId` to disposition; rejects duplicate keys. */
export function indexEvidenceLedger(
  entries: readonly EvidenceLedgerEntry[],
): Map<string, EvidenceLedgerDisposition> {
  const index = new Map<string, EvidenceLedgerDisposition>();
  for (const entry of entries) {
    const key = ledgerKey(entry.platform, entry.factId);
    if (index.has(key)) {
      throw new Error(`Duplicate gate index key: ${key}`);
    }
    index.set(key, entry.disposition);
  }
  return index;
}

/** Fact ids that are unverified in coverage but absent from the ledger. */
export function findUnledgeredUnverifiedFacts(
  coverage: {
    platform: PlatformId;
    facts: readonly CoverageFact[];
    matrix: readonly CoverageMatrixEntry[];
  },
  ledgerIndex: ReadonlyMap<string, EvidenceLedgerDisposition>,
): string[] {
  const referenced = new Set(
    coverage.matrix.flatMap((entry) => [...entry.factRefs]),
  );
  const missing: string[] = [];

  for (const fact of coverage.facts) {
    if (referenced.has(fact.id)) {
      continue;
    }
    if (!ledgerIndex.has(ledgerKey(coverage.platform, fact.id))) {
      missing.push(fact.id);
    }
  }

  return missing.sort();
}

/** Fact ids listed in the ledger but now matrix-referenced (stale rows). */
export function findStaleLedgerEntries(
  coverage: {
    platform: PlatformId;
    facts: readonly CoverageFact[];
    matrix: readonly CoverageMatrixEntry[];
  },
  ledgerIndex: ReadonlyMap<string, EvidenceLedgerDisposition>,
): string[] {
  const referenced = new Set(
    coverage.matrix.flatMap((entry) => [...entry.factRefs]),
  );
  const stale: string[] = [];

  for (const fact of coverage.facts) {
    if (!referenced.has(fact.id)) {
      continue;
    }
    if (ledgerIndex.has(ledgerKey(coverage.platform, fact.id))) {
      stale.push(fact.id);
    }
  }

  return stale.sort();
}
