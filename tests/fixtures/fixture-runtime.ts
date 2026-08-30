import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { SourceInfo } from "../../src/core/model/index.js";

/**
 * Fixture runs must depend on the fixture, not on the machine (§11.2, §13
 * invariant 2). `buildPlatformEnvironment` reads the `env` block of
 * `~/.claude/settings.json` and `readTrustState` reads `~/.claude.json`, so on
 * a developer box carrying either file a golden would record that developer's
 * configuration. Golden runs therefore point `$HOME` at an empty directory.
 *
 * Production behaviour is untouched: the product still reads the real
 * `~/.claude/` when scanning a real project (S1) — only the fixture runners
 * relocate the home they read.
 */
let isolatedHome: string | undefined;

export function fixtureHomeDir(): string {
  if (isolatedHome === undefined) {
    isolatedHome = fs.mkdtempSync(path.join(os.tmpdir(), "capsight-fixture-home-"));
  }
  return isolatedHome;
}

export function cleanupFixtureHome(): void {
  if (isolatedHome !== undefined) {
    fs.rmSync(isolatedHome, { recursive: true, force: true });
    isolatedHome = undefined;
  }
}

/**
 * Fixture runs must also not read the repository that ships them (§11.2, §13
 * invariant 2) — the same class of leak H1-22 closed for `$HOME`.
 *
 * `walkProjectScopes` climbs upward until it finds a directory containing
 * `.git`. A fixture tree carries no such marker, so the walk ran past
 * `tests/fixtures/<platform>/<name>/project` into the Capsight checkout and
 * read this repository's own `.claude/agents/`. Adding `reviewer.md` to it
 * collided (A1) with `add-dir`'s own `reviewer` and broke five goldens: the
 * goldens were measuring the developer's repository.
 *
 * Git refuses to index a path named `.git`, so the marker cannot be committed
 * into a fixture tree; the test run creates it and removes it again
 * (`tests/fixtures/global-setup.ts`, `.gitignore`). The marker is created
 * *in place* rather than in a copy under `os.tmpdir()` because the corpus is
 * the checked-out tree; a relocated copy now produces the identical golden
 * (D1-09 removed the absolute path from capability ordering), which
 * `materializeFixtureAtCheckout` relies on.
 *
 * Production behaviour is untouched — no `stopAt` override exists, so the
 * corpus exercises exactly the boundary logic a real scan takes; the fixture
 * project is simply made into the repository root the walk is looking for.
 */
export function fixtureProjectRoots(fixturesRoot: string): string[] {
  if (!fs.existsSync(fixturesRoot)) {
    return [];
  }
  return fs
    .readdirSync(fixturesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(fixturesRoot, entry.name, "project"))
    .filter((projectRoot) => fs.existsSync(projectRoot));
}

/**
 * Create the repo-root marker at each fixture project, and return the ones
 * this call created so a teardown can remove exactly those. Creation is
 * idempotent: an already-present marker is left alone and not reported, so a
 * leftover from a crashed run is never deleted out from under a concurrent one.
 */
export function createFixtureRepoRoots(projectRoots: readonly string[]): string[] {
  const created: string[] = [];
  for (const projectRoot of projectRoots) {
    const marker = path.join(projectRoot, ".git");
    if (fs.existsSync(marker)) {
      continue;
    }
    fs.mkdirSync(marker, { recursive: true });
    created.push(marker);
  }
  return created;
}

export function removeFixtureRepoRoots(markers: readonly string[]): void {
  for (const marker of markers) {
    fs.rmSync(marker, { recursive: true, force: true });
  }
}

/**
 * Absolute checkout paths a run has to be indifferent to (§11.2, §13
 * invariant 2). They are unrelated to each other and to the corpus one, and
 * the first is the shape GitHub Actions checks out into by default — the one
 * that would have kept the suite red in CI while it passed locally.
 *
 * Each is realized as a suffix under its own `os.tmpdir()` container: a test
 * cannot create `/home/runner/...` on the machine it runs on, and does not
 * need to. What the goldens were sensitive to is the absolute path *string*
 * (it was hashed into instruction ids), and these four share no component
 * with one another.
 */
export const CHECKOUT_SHAPES = [
  "home/runner/work/capsight/capsight",
  "home/alice/capsight",
  "Users/bob/dev/capsight",
  "srv/ci/build",
] as const;

let relocatedCheckouts: string[] = [];

/**
 * Copy a fixture so it can be replayed from an unrelated absolute path.
 *
 * The copy carries the repo-root marker `global-setup.ts` created in the
 * corpus fixture before any test ran, so the scope walk still stops at
 * `project/` — it is the checkout location that changes and nothing else.
 */
export function materializeFixtureAtCheckout(
  fixtureDir: string,
  shape: string,
): string {
  const source = path.resolve(fixtureDir);
  const container = fs.mkdtempSync(
    path.join(os.tmpdir(), "capsight-checkout-"),
  );
  relocatedCheckouts.push(container);
  const target = path.join(container, ...shape.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
  const marker = path.join(target, "project", ".git");
  if (!fs.existsSync(marker)) {
    throw new Error(
      `Relocated fixture ${target} has no repo-root marker; the walk would climb out of it.`,
    );
  }
  return target;
}

export function cleanupRelocatedCheckouts(): void {
  for (const container of relocatedCheckouts) {
    fs.rmSync(container, { recursive: true, force: true });
  }
  relocatedCheckouts = [];
}

/**
 * Copy a fixture into a temp container, without the repo-root marker, so a
 * test can show what the unisolated walk does. Only the leak demonstration in
 * `run-golden.test.ts` uses this.
 */
export function materializeUnisolatedFixture(fixtureDir: string): string {
  const source = path.resolve(fixtureDir);
  if (unisolatedWorkspace === undefined) {
    unisolatedWorkspace = fs.mkdtempSync(
      path.join(os.tmpdir(), "capsight-fixture-leak-"),
    );
  }
  const container = fs.mkdtempSync(
    path.join(unisolatedWorkspace, `${path.basename(source)}-`),
  );
  // Ceiling of last resort: a walk with no fixture marker must still stop
  // inside the temp container instead of climbing to the filesystem root.
  fs.mkdirSync(path.join(container, ".git"), { recursive: true });
  const target = path.join(container, path.basename(source));
  fs.cpSync(source, target, { recursive: true });
  // The corpus fixture carries the run's repo-root marker by now; the copy is
  // deliberately without one, so the walk climbs past `project/`.
  fs.rmSync(path.join(target, "project", ".git"), { recursive: true, force: true });
  return target;
}

let unisolatedWorkspace: string | undefined;

export function cleanupUnisolatedFixtures(): void {
  if (unisolatedWorkspace !== undefined) {
    fs.rmSync(unisolatedWorkspace, { recursive: true, force: true });
    unisolatedWorkspace = undefined;
  }
}

/**
 * Restore `process.env` in place. Reassigning `process.env` replaces Node's
 * live environment binding with a plain object, after which `os.homedir()` —
 * which reads the real environment — stops seeing `$HOME` changes and the home
 * isolation above would silently stop working.
 */
export function restoreProcessEnv(snapshot: NodeJS.ProcessEnv): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(snapshot)) {
    if (value !== undefined && process.env[key] !== value) {
      process.env[key] = value;
    }
  }
}

export interface FixtureAgentSelector {
  agentName: string;
  /**
   * Project-relative posix path of the agent file, required when the fixture
   * declares more than one agent under the same name (an A4 collision). A4 has
   * no documented rule for which file loads, so picking "the first entry" would
   * make the golden depend on directory read order.
   */
  agentSourcePath?: string;
}

export interface FixtureAgentLike {
  name: string;
  source: SourceInfo;
}

function toPosixRelative(projectRoot: string, value: string): string {
  const relative = path.relative(path.resolve(projectRoot), path.resolve(value));
  return relative.split(path.sep).join("/");
}

/**
 * Resolve the fixture's subject agent unambiguously. A name that matches
 * several snapshot entries is an error unless `contexts.json` disambiguates it
 * with `agentSourcePath`, so a differently-ordered directory walk can never
 * silently change which candidate a golden describes.
 */
export function selectFixtureAgent<T extends FixtureAgentLike>(
  agents: readonly T[],
  selector: FixtureAgentSelector,
  projectRoot: string,
): T {
  const byName = agents.filter((entry) => entry.name === selector.agentName);
  if (byName.length === 0) {
    throw new Error(`agent ${selector.agentName} should exist`);
  }

  if (selector.agentSourcePath === undefined) {
    if (byName.length > 1) {
      const paths = byName
        .map((entry) =>
          entry.source.path === undefined
            ? "<no path>"
            : toPosixRelative(projectRoot, entry.source.path),
        )
        .sort();
      throw new Error(
        `agent ${selector.agentName} is declared by ${byName.length} entries ` +
          `(${paths.join(", ")}); contexts.json must set "agentSourcePath" to ` +
          `name the subject, otherwise the golden depends on read order`,
      );
    }
    return byName[0]!;
  }

  const matches = byName.filter(
    (entry) =>
      entry.source.path !== undefined &&
      toPosixRelative(projectRoot, entry.source.path) === selector.agentSourcePath,
  );
  if (matches.length !== 1) {
    throw new Error(
      `agent ${selector.agentName} at ${selector.agentSourcePath} should match ` +
        `exactly one entry, matched ${matches.length}`,
    );
  }
  return matches[0]!;
}
