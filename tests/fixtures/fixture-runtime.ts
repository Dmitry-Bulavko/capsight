import crypto from "node:crypto";
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
    throw new Error(
      `Fixture corpus root ${fixturesRoot} does not exist; the isolation hook ` +
        `would silently create no repo-root markers and every fixture scan ` +
        `would walk into the Capsight checkout.`,
    );
  }
  return fs
    .readdirSync(fixturesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(fixturesRoot, entry.name, "project"))
    .filter((projectRoot) => fs.existsSync(projectRoot));
}

/**
 * Identifies one test run's claim on the fixture repo-root markers. Two runs
 * sharing a working tree hold independent claims on the same marker.
 */
export interface FixtureRepoRootLease {
  readonly runId: string;
  readonly markers: readonly string[];
}

/** Claim files live inside the marker directory, which `.gitignore` covers. */
const CLAIM_PREFIX = "capsight-run-";

/**
 * Upper bound on a claim's life. A pid alone is not proof of ownership: pids
 * are reused, so a long-dead claim whose number has come round again would
 * read as live forever. No test run lasts hours.
 */
const MAX_CLAIM_AGE_MS = 6 * 60 * 60 * 1000;

/**
 * Environment variable the isolation hook publishes its run id in, so a test
 * can assert *this* run holds the lease rather than that some marker exists.
 * Set in `global-setup.ts`, which runs before vitest forks its workers, so the
 * workers inherit it.
 */
export const FIXTURE_RUN_ID_ENV = "CAPSIGHT_FIXTURE_RUN_ID";

function claimPath(marker: string, runId: string): string {
  return path.join(marker, `${CLAIM_PREFIX}${runId}`);
}

function newRunId(): string {
  return `${process.pid}-${crypto.randomUUID()}`;
}

function claimOwnerPid(entry: string): number | undefined {
  const pid = Number.parseInt(entry.slice(CLAIM_PREFIX.length).split("-")[0] ?? "", 10);
  return Number.isInteger(pid) && pid > 0 ? pid : undefined;
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists and belongs to somebody else.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Is this claim held by a run that is still going?
 *
 * A claim outlives its owner whenever a run dies without tearing down — a
 * SIGKILL, or the SIGPIPE a `vitest ... | head` takes when the pipe closes.
 * Nothing reaps it on its own, so an unreaped claim pins its marker forever,
 * and a pinned marker makes `assertFixtureIsolated` pass whether or not the
 * isolation hook ran: the guard stops being able to observe what it guards
 * (H1-07). Liveness is therefore never assumed from the file's existence.
 */
function claimIsLive(marker: string, entry: string): boolean {
  if (!entry.startsWith(CLAIM_PREFIX)) {
    return false;
  }
  let mtimeMs: number;
  try {
    mtimeMs = fs.statSync(path.join(marker, entry)).mtimeMs;
  } catch {
    return false;
  }
  if (Date.now() - mtimeMs > MAX_CLAIM_AGE_MS) {
    return false;
  }
  const pid = claimOwnerPid(entry);
  return pid !== undefined && processIsAlive(pid);
}

function readClaims(marker: string): string[] {
  try {
    return fs.readdirSync(marker).filter((entry) => entry.startsWith(CLAIM_PREFIX));
  } catch {
    return [];
  }
}

/** Delete every claim whose owning run is gone. Safe to call concurrently. */
function reapDeadClaims(marker: string): void {
  for (const entry of readClaims(marker)) {
    if (claimIsLive(marker, entry)) {
      continue;
    }
    fs.rmSync(path.join(marker, entry), { force: true });
  }
}

/**
 * Claim the repo-root marker at each fixture project on behalf of one run.
 *
 * Creation is idempotent, but removal must not be: two runs in one working
 * tree overlap, and a teardown that removed the marker unconditionally would
 * strip isolation out from under a run still scanning — the exact failure this
 * hook exists to prevent, arriving as a flake. Each run therefore drops a
 * claim file inside the marker directory and the last run out removes it
 * (refcount by filesystem).
 *
 * Dead claims are reaped here rather than trusted, so an interrupted run
 * cannot pin a marker — and with it the isolation assertions — indefinitely.
 */
export function acquireFixtureRepoRoots(
  projectRoots: readonly string[],
  runId: string = newRunId(),
): FixtureRepoRootLease {
  const markers: string[] = [];
  for (const projectRoot of projectRoots) {
    const marker = path.join(projectRoot, ".git");
    // A concurrent release can remove the marker between the mkdir and the
    // write, which surfaces as ENOENT on the claim. Retry rather than fail:
    // the loser of that race simply recreates the marker it needs.
    for (let attempt = 0; ; attempt += 1) {
      try {
        fs.mkdirSync(marker, { recursive: true });
        reapDeadClaims(marker);
        fs.writeFileSync(claimPath(marker, runId), "", "utf8");
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT" || attempt >= 10) {
          throw error;
        }
      }
    }
    markers.push(marker);
  }
  return { runId, markers };
}

/**
 * Drop this run's claim, and remove the marker only if no other run holds one.
 *
 * The emptiness test and the removal are the same syscall: `rmdir` fails with
 * ENOTEMPTY if a claim is present, so a run that acquires between this run's
 * two steps cannot have its claim deleted out from under it. A recursive
 * `rm` after a separate `readdir` would leave exactly that window open.
 */
export function releaseFixtureRepoRoots(lease: FixtureRepoRootLease): void {
  for (const marker of lease.markers) {
    fs.rmSync(claimPath(marker, lease.runId), { force: true });
    reapDeadClaims(marker);
    try {
      fs.rmdirSync(marker);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOTEMPTY" && code !== "ENOENT") {
        throw error;
      }
    }
  }
}

/**
 * Precondition every golden runner shares: the isolation hook
 * (`tests/fixtures/global-setup.ts`) has given this fixture project a
 * repo-root marker *for this run*. Without it a scope walk climbs out of the
 * fixture into the Capsight checkout, so a golden would record the developer's
 * configuration.
 *
 * The assertion is on this run's claim, not on the marker's existence: a
 * marker left behind by an interrupted run would otherwise satisfy it forever
 * and the guard would pass while guarding nothing (H1-07). When no run id is
 * published — a caller using the lease API directly — it falls back to
 * requiring a claim whose owning process is still alive.
 *
 * Asserted per platform rather than once: the hook is the only thing standing
 * between the corpus and the checkout, and a corpus that cannot observe it
 * losing effect is not guarded (§11.3, H1-07).
 */
export function assertFixtureIsolated(fixtureDir: string): void {
  const marker = path.join(path.resolve(fixtureDir), "project", ".git");
  const runId = process.env[FIXTURE_RUN_ID_ENV];
  const held =
    runId !== undefined
      ? fs.existsSync(claimPath(marker, runId))
      : readClaims(marker).some((entry) => claimIsLive(marker, entry));
  if (!held) {
    throw new Error(
      `Fixture ${fixtureDir} carries no live repo-root claim at ${marker}` +
        (runId === undefined ? "" : ` for run ${runId}`) +
        `: the isolation hook (tests/fixtures/global-setup.ts) did not run for ` +
        `this run, so this scan can climb into the Capsight checkout. A marker ` +
        `left behind by an interrupted run does not count.`,
    );
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
 * test can show what the unisolated walk does. Used by the leak demonstrations
 * in `run-golden.test.ts` and `run-codex-golden.test.ts`.
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
