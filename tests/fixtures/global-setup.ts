import {
  createFixtureRepoRoots,
  fixtureProjectRoots,
  removeFixtureRepoRoots,
} from "./fixture-runtime.js";
import { PLATFORM_IDS, platformFixturesRoot } from "./coverage-report.js";

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
 */
export default function setup(): () => void {
  const created = PLATFORM_IDS.flatMap((platform) =>
    createFixtureRepoRoots(fixtureProjectRoots(platformFixturesRoot(platform))),
  );
  return () => {
    removeFixtureRepoRoots(created);
  };
}
