import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { M1_DOC_FACTS, type FactId } from "../../src/adapters/claude/version/facts.js";
import { VERSION_MATRIX } from "../../src/adapters/claude/version/matrix.js";
import type { ResolvedCapability } from "../../src/core/model/index.js";
import type {
  NormalizedGoldenOutput,
  NormalizedResolution,
} from "./golden-normalize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURES_ROOT = path.join(__dirname, "claude");

export type CoverageTier = "fixture-verified" | "documentation-only" | "unverified";

export interface CoverageReport {
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

/** Confident statuses are every value except `unknown` (SPEC §11.3). */
export function isConfidentCapabilityStatus(
  status: ResolvedCapability["status"],
): boolean {
  return status !== "unknown";
}

/**
 * Returns mismatches where actual output makes a confident capability claim
 * that differs from the golden expectation. `unknown` actual status never fails.
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
      if (!isConfidentCapabilityStatus(actualCapability.status)) {
        continue;
      }

      const expectedCapability = expectedById.get(actualCapability.capabilityId);
      const statusDiffers =
        !expectedCapability ||
        actualCapability.status !== expectedCapability.status;
      // `unknown` enforcement is not a confident claim, so it never blocks (§11.3).
      const enforcementDiffers =
        actualCapability.enforcement !== "unknown" &&
        (!expectedCapability ||
          actualCapability.enforcement !== expectedCapability.enforcement);

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

function coverageTierForFact(
  factId: FactId,
  availableFixtures: ReadonlySet<string>,
): CoverageTier {
  let tier: CoverageTier = "unverified";

  for (const entry of VERSION_MATRIX) {
    if (!entry.factRefs.includes(factId)) {
      continue;
    }

    if (entry.fixture && availableFixtures.has(entry.fixture)) {
      tier = "fixture-verified";
      break;
    }

    if (entry.confidence === "doc" && COVERAGE_RANK["documentation-only"] > COVERAGE_RANK[tier]) {
      tier = "documentation-only";
    }
  }

  return tier;
}

/** Fixed-denominator coverage counts for §3 facts referenced by M1 resolver rules. */
export function buildCoverageReport(
  availableFixtures: readonly string[] = discoverFixtureNames(),
): CoverageReport {
  const fixtureSet = new Set(availableFixtures);
  let fixtureVerified = 0;
  let documentationOnly = 0;
  let unverified = 0;

  for (const factId of M1_DOC_FACTS) {
    const tier = coverageTierForFact(factId, fixtureSet);
    switch (tier) {
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
    runtimeObserved: 0,
    fixtureVerified,
    documentationOnly,
    unverified,
  };
}

export function formatCoverageReport(report: CoverageReport): string {
  return [
    "runtime-observed    : " + report.runtimeObserved,
    "fixture-verified    : " + report.fixtureVerified,
    "documentation-only  : " + report.documentationOnly,
    "unverified          : " + report.unverified,
  ].join("\n");
}
