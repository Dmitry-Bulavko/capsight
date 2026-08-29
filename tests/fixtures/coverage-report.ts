import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FACTS, type FactId } from "../../src/adapters/claude/version/facts.js";
import {
  VERSION_MATRIX,
  type FeatureCompatibility,
} from "../../src/adapters/claude/version/matrix.js";
import type { ResolvedCapability } from "../../src/core/model/index.js";
import type {
  NormalizedGoldenOutput,
  NormalizedResolution,
} from "./golden-normalize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURES_ROOT = path.join(__dirname, "claude");

export type CoverageTier =
  | "runtime-observed"
  | "fixture-verified"
  | "documentation-only"
  | "unverified";

export interface CoverageReport {
  /** Fixed denominator: every §3 fact registered in `facts.ts` (SPEC §11.4). */
  total: number;
  runtimeObserved: number;
  fixtureVerified: number;
  documentationOnly: number;
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

/** The SPEC §11.1 corpus, declared explicitly so a dropped fixture is visible. */
export const SPEC_FIXTURE_NAMES = [
  "add-dir",
  "background",
  "basic",
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

export type FixtureCompleteness = "complete" | "incomplete" | "empty" | "missing";

export interface FixtureStatus {
  name: string;
  completeness: FixtureCompleteness;
  missingEntries: FixtureRequiredEntry[];
}

const COVERAGE_RANK: Record<CoverageTier, number> = {
  unverified: 0,
  "documentation-only": 1,
  "fixture-verified": 2,
  "runtime-observed": 3,
};

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
  fixturesRoot: string = FIXTURES_ROOT,
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
  fixturesRoot: string = FIXTURES_ROOT,
): FixtureStatus[] {
  return SPEC_FIXTURE_NAMES.map((name) => inspectFixture(name, fixturesRoot));
}

/** Directories present on disk that are not part of the declared §11.1 corpus. */
export function findUndeclaredFixtureDirectories(
  fixturesRoot: string = FIXTURES_ROOT,
): string[] {
  const declared = new Set<string>(SPEC_FIXTURE_NAMES);
  return fs
    .readdirSync(fixturesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !declared.has(name))
    .sort();
}

/** Fixtures that are not yet runnable: anything not `complete`. */
export function pendingFixtureNames(
  fixturesRoot: string = FIXTURES_ROOT,
): string[] {
  return inspectFixtureCorpus(fixturesRoot)
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
  fixturesRoot: string = FIXTURES_ROOT,
): string[] {
  return inspectFixtureCorpus(fixturesRoot)
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
function entryFactCoverageTier(
  entry: FeatureCompatibility,
  factId: FactId,
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
export function classifyFactCoverage(
  factId: FactId,
  availableFixtures: ReadonlySet<string>,
  matrix: readonly FeatureCompatibility[] = VERSION_MATRIX,
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

  return tier;
}

export interface CoverageReportOptions {
  /** Denominator override, for tests only. Defaults to the full §3 registry. */
  facts?: readonly { readonly id: FactId }[];
  matrix?: readonly FeatureCompatibility[];
}

/**
 * Coverage counts over the fixed §3 fact corpus (SPEC §11.4). The denominator
 * is the whole registry in `facts.ts`, never the subset the implementation
 * happens to reference, so the metric can only rise by adding evidence.
 *
 * CI diagnostic only: this number is a property of the test suite, not of the
 * scanned project, and must never reach a route or a UI component
 * (SPEC §13 invariant 13). The user-facing number is
 * `EffectiveConfiguration.unknownRate`.
 */
export function buildCoverageReport(
  availableFixtures: readonly string[] = discoverFixtureNames(),
  options: CoverageReportOptions = {},
): CoverageReport {
  const fixtureSet = new Set(availableFixtures);
  const facts = options.facts ?? FACTS;
  const matrix = options.matrix ?? VERSION_MATRIX;

  let runtimeObserved = 0;
  let fixtureVerified = 0;
  let documentationOnly = 0;
  let unverified = 0;

  for (const fact of facts) {
    switch (classifyFactCoverage(fact.id, fixtureSet, matrix)) {
      case "runtime-observed":
        runtimeObserved += 1;
        break;
      case "fixture-verified":
        fixtureVerified += 1;
        break;
      case "documentation-only":
        documentationOnly += 1;
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
    unverified,
  };
}

export function formatCoverageReport(report: CoverageReport): string {
  return [
    "SPEC §3 facts       : " + report.total,
    "runtime-observed    : " + report.runtimeObserved,
    "fixture-verified    : " + report.fixtureVerified,
    "documentation-only  : " + report.documentationOnly,
    "unverified          : " + report.unverified,
  ].join("\n");
}
