import { randomUUID } from "node:crypto";
import {
  FIXTURE_RUN_ID_ENV,
  acquireFixtureRepoRoots,
  fixtureProjectRoots,
  releaseFixtureRepoRoots,
  type FixtureRepoRootLease,
} from "./fixture-runtime.js";
import {
  ECOSYSTEM_FIXTURE_NAMES,
  PLATFORM_IDS,
  ecosystemFixturesRoot,
  platformFixturesRoot,
} from "./coverage-report.js";

/**
 * Give every fixture project a repository root, for the whole test run.
 *
 * Without it a fixture scan walks past `project/` into the Capsight checkout
 * and reads this repository's own `.claude/agents/`, so a golden records the
 * developer's configuration instead of the fixture (§11.2, §13 invariant 2).
 * All four runners — the three golden runners and the correctness gate — are
 * isolated by this one hook, so none of them can drift from the others.
 *
 * Global rather than per-file: fixture directories are shared across test
 * files, so a per-file teardown could remove a marker while another file is
 * still scanning.
 *
 * A declared platform that yields no project roots is a hard failure, not a
 * no-op: if a corpus directory is renamed or moved, silently creating zero
 * markers would put every fixture of that platform back on the developer's
 * checkout while the suite stayed green (§11.3, H1-07).
 *
 * The run id is published to the workers (this runs before vitest forks them)
 * so `assertFixtureIsolated` can check that *this* run holds the lease. A
 * marker orphaned by an interrupted run must not be able to satisfy the guard.
 */
export default function setup(): () => void {
  const runId = `${process.pid}-${randomUUID()}`;
  process.env[FIXTURE_RUN_ID_ENV] = runId;
  const leases: FixtureRepoRootLease[] = [];
  for (const platform of PLATFORM_IDS) {
    const fixturesRoot = platformFixturesRoot(platform);
    const projectRoots = fixtureProjectRoots(fixturesRoot);
    if (projectRoots.length === 0) {
      throw new Error(
        `Platform ${platform} declares a fixture corpus at ${fixturesRoot} but ` +
          `it contains no <fixture>/project directory: the isolation hook would ` +
          `create no repo-root markers and every ${platform} fixture scan would ` +
          `climb into the Capsight checkout.`,
      );
    }
    leases.push(acquireFixtureRepoRoots(projectRoots, runId));
  }

  const ecosystemRoot = ecosystemFixturesRoot();
  const ecosystemProjectRoots = fixtureProjectRoots(ecosystemRoot);
  if (ecosystemProjectRoots.length !== ECOSYSTEM_FIXTURE_NAMES.length) {
    throw new Error(
      `Ecosystem fixture corpus at ${ecosystemRoot} must contain exactly ` +
        `${ECOSYSTEM_FIXTURE_NAMES.length} <fixture>/project director` +
        `${ECOSYSTEM_FIXTURE_NAMES.length === 1 ? "y" : "ies"}; found ` +
        `${ecosystemProjectRoots.length}. Without repo-root markers every ` +
        `ecosystem fixture scan would climb into the Capsight checkout.`,
    );
  }
  leases.push(acquireFixtureRepoRoots(ecosystemProjectRoots, runId));
  return () => {
    for (const lease of leases) {
      releaseFixtureRepoRoots(lease);
    }
    delete process.env[FIXTURE_RUN_ID_ENV];
  };
}
