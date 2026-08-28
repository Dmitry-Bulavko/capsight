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
  fixtureName: string;
  agentName: string;
  capabilityId: string;
  actualStatus: ResolvedCapability["status"];
  expectedStatus: ResolvedCapability["status"] | undefined;
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
): CapabilityMismatch[] {
  const mismatches: CapabilityMismatch[] = [];

  const actualByKey = new Map(
    actual.resolutions.map((entry) => [resolutionKey(entry), entry]),
  );

  for (const expectedResolution of expected.resolutions) {
    const actualResolution = actualByKey.get(resolutionKey(expectedResolution));
    if (!actualResolution) {
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
      if (
        !expectedCapability ||
        actualCapability.status !== expectedCapability.status
      ) {
        mismatches.push({
          fixtureName,
          agentName: expectedResolution.agentName,
          capabilityId: actualCapability.capabilityId,
          actualStatus: actualCapability.status,
          expectedStatus: expectedCapability?.status,
        });
      }
    }
  }

  return mismatches;
}

export function discoverFixtureNames(
  fixturesRoot: string = FIXTURES_ROOT,
): string[] {
  return fs
    .readdirSync(fixturesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) =>
      fs.existsSync(path.join(fixturesRoot, entry.name, "expected.json")),
    )
    .map((entry) => entry.name)
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
