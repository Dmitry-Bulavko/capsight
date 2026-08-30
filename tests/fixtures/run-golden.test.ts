import { spawn } from "node:child_process";
import fsSync from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import type {
  EffectiveConfiguration,
  PlatformVersion,
} from "../../src/core/model/index.js";
import type { ManagedSimulationResult } from "../../src/application/simulate.js";
import { buildExecutionContext } from "../../src/adapters/claude/resolution/context.js";
import type { ContextPreset } from "../../src/core/model/index.js";
import type {
  ClaudeProjectSnapshot,
  PermissionMode,
} from "../../src/adapters/claude/model/index.js";
import {
  CLAUDE_FIXTURE_NAMES,
  discoverFixtureNames,
  formatPendingFixtures,
  inspectFixtureCorpus,
  resolveFixtureAddDirs,
  resolveFixturePluginRoots,
  resolveFixtureManagedBundle,
  resolveFixtureScanPath,
} from "./coverage-report.js";
import {
  normalizeGoldenOutput,
  type NormalizedGoldenOutput,
} from "./golden-normalize.js";
import {
  CHECKOUT_SHAPES,
  FIXTURE_RUN_ID_ENV,
  acquireFixtureRepoRoots,
  assertFixtureIsolated,
  cleanupFixtureHome,
  cleanupRelocatedCheckouts,
  cleanupUnisolatedFixtures,
  fixtureHomeDir,
  materializeFixtureAtCheckout,
  materializeUnisolatedFixture,
  releaseFixtureRepoRoots,
  restoreProcessEnv,
  selectFixtureAgent,
} from "./fixture-runtime.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = path.join(__dirname, "claude");

const { mockDetectClaudeVersion } = vi.hoisted(() => ({
  mockDetectClaudeVersion: vi.fn<() => Promise<PlatformVersion>>(),
}));

vi.mock("../../src/adapters/claude/version/index.js", () => ({
  detectClaudeVersion: mockDetectClaudeVersion,
  defaultCommandRunner: { run: vi.fn() },
}));

interface FixtureContextSpec {
  agentName: string;
  /** Disambiguator for a name carried by more than one entry (A4). */
  agentSourcePath?: string;
  preset: ContextPreset;
  depth?: number;
  maxDepth?: number;
  parentPermissionMode?: PermissionMode;
}

interface FixtureContract {
  env: Record<string, string>;
  version: string;
  contexts: FixtureContextSpec[];
}

async function loadFixtureContract(fixtureDir: string): Promise<FixtureContract> {
  const [envRaw, versionRaw, contextsRaw] = await Promise.all([
    fsPromises.readFile(path.join(fixtureDir, "env.json"), "utf8"),
    fsPromises.readFile(path.join(fixtureDir, "version.txt"), "utf8"),
    fsPromises.readFile(path.join(fixtureDir, "contexts.json"), "utf8"),
  ]);

  return {
    env: JSON.parse(envRaw) as Record<string, string>,
    version: versionRaw.trim(),
    contexts: JSON.parse(contextsRaw) as FixtureContextSpec[],
  };
}

function applyFixtureEnv(env: Record<string, string>, homeDir?: string): void {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("CLAUDE_")) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
  // User-level settings (`~/.claude/settings.json`) and trust
  // (`~/.claude.json`) reach a golden through `discovery.environment` and
  // `discovery.trust`. A fixture run reads an empty home instead of the
  // developer's, so the corpus depends on the input only (§13 invariant 2).
  const home = homeDir ?? fixtureHomeDir();
  vi.stubEnv("HOME", home);
  vi.stubEnv("USERPROFILE", home);
}

interface RunGoldenOptions {
  /**
   * Home directory the run reads user-level settings and trust from. Defaults
   * to the isolated fixture home; a test overrides it to show what a
   * developer's own `~/.claude/` would otherwise do to a golden.
   */
  homeDir?: string;
  /**
   * Rewrites the snapshot between scan and resolution, so a test can prove a
   * golden does not depend on the order the scan happened to produce.
   */
  mutateSnapshot?: (snapshot: ClaudeProjectSnapshot) => ClaudeProjectSnapshot;
  /**
   * Fixture directory the run reads, instead of the corpus one. The leak
   * demonstration overrides it with an unisolated copy, and the portability
   * test with a copy replayed from an unrelated absolute checkout path.
   */
  fixtureDir?: string;
}

async function runGoldenFixture(
  fixtureName: string,
  options: RunGoldenOptions = {},
): Promise<{ actual: NormalizedGoldenOutput; expected: NormalizedGoldenOutput }> {
  const fixtureDir = options.fixtureDir ?? path.join(FIXTURES_ROOT, fixtureName);
  const projectRoot = path.join(fixtureDir, "project");
  const contract = await loadFixtureContract(fixtureDir);
  const expected = JSON.parse(
    await fsPromises.readFile(path.join(fixtureDir, "expected.json"), "utf8"),
  ) as NormalizedGoldenOutput;

  applyFixtureEnv(contract.env, options.homeDir);
  mockDetectClaudeVersion.mockResolvedValue({
    platform: "claude",
    version: contract.version,
    raw: contract.version,
    detectedAt: "1970-01-01T00:00:00.000Z",
  });

  const { scan } = await import("../../src/application/scan.js");
  const { resolve } = await import("../../src/application/resolve.js");

  const addDirs = resolveFixtureAddDirs(fixtureDir);
  const pluginRoots = resolveFixturePluginRoots(fixtureDir);
  const scanResult = await scan({
    projectPath: resolveFixtureScanPath(fixtureDir),
    ...(addDirs.length > 0 ? { addDirs } : {}),
    ...(pluginRoots.length > 0 ? { pluginRoots } : {}),
  });
  const snapshot = options.mutateSnapshot
    ? options.mutateSnapshot(scanResult.snapshot)
    : scanResult.snapshot;
  const resolutions: Array<{ agentName: string; resolution: EffectiveConfiguration }> =
    [];

  for (const contextSpec of contract.contexts) {
    const agent = selectFixtureAgent(
      snapshot.agents,
      contextSpec,
      projectRoot,
    );

    const context = buildExecutionContext(contextSpec.preset, {
      ...(contextSpec.depth !== undefined ? { depth: contextSpec.depth } : {}),
      ...(contextSpec.maxDepth !== undefined ? { maxDepth: contextSpec.maxDepth } : {}),
      ...(contextSpec.parentPermissionMode !== undefined
        ? { parentPermissionMode: contextSpec.parentPermissionMode }
        : {}),
    });

    const resolution = await resolve({
      snapshot,
      agentId: agent.id,
      context,
    });

    resolutions.push({ agentName: contextSpec.agentName, resolution });
  }

  // A fixture that ships a `managed-bundle/` also records the §7.8 delta.
  const managedBundlePath = resolveFixtureManagedBundle(fixtureDir);
  let simulation: ManagedSimulationResult | undefined;
  if (managedBundlePath) {
    const { simulateManagedOverlay } = await import(
      "../../src/application/simulate.js"
    );
    simulation = await simulateManagedOverlay({
      managedBundlePath,
      snapshot,
    });
  }

  const actual = normalizeGoldenOutput(
    snapshot,
    resolutions,
    projectRoot,
    simulation,
  );
  return { actual, expected };
}

/**
 * Reverse everything an A4 collision leaves unordered: the snapshot entries
 * themselves and the candidate list each ambiguous entry carries. A4 documents
 * no rule for which colliding file loads, so a golden that survives this
 * reversal does not depend on the directory walk.
 */
function reverseCandidateOrder(
  snapshot: ClaudeProjectSnapshot,
): ClaudeProjectSnapshot {
  return {
    ...snapshot,
    agents: [...snapshot.agents]
      .reverse()
      .map((agent) =>
        agent.collision
          ? {
              ...agent,
              collision: {
                ...agent.collision,
                candidates: [...agent.collision.candidates].reverse(),
              },
            }
          : agent,
      ),
  };
}

describe("golden fixtures", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    vi.unstubAllEnvs();
    restoreProcessEnv(envSnapshot);
    mockDetectClaudeVersion.mockReset();
  });

  afterAll(() => {
    cleanupFixtureHome();
    cleanupUnisolatedFixtures();
    cleanupRelocatedCheckouts();
  });

  for (const fixtureName of discoverFixtureNames(
    FIXTURES_ROOT,
    CLAUDE_FIXTURE_NAMES,
  )) {
    it(`matches expected discovery and resolution for claude/${fixtureName}`, async () => {
      const { actual, expected } = await runGoldenFixture(fixtureName);
      expect(actual).toEqual(expected);
    });
  }

  // §13 invariant 2: a golden must depend on the fixture, not on the machine.
  // `discovery.environment` carries the `env` block of `~/.claude/settings.json`
  // and `discovery.trust` reads `~/.claude.json`, so a developer carrying
  // either would otherwise see fixture failures that have nothing to do with
  // the change under test.
  it("keeps a user-level env block and trust record out of a golden", async () => {
    const fixtureProject = path.resolve(
      FIXTURES_ROOT,
      "environment",
      "project",
    );
    const dirtyHome = fsSync.mkdtempSync(
      path.join(os.tmpdir(), "capsight-dirty-home-"),
    );
    fsSync.mkdirSync(path.join(dirtyHome, ".claude"));
    fsSync.writeFileSync(
      path.join(dirtyHome, ".claude", "settings.json"),
      JSON.stringify({ env: { CAPSIGHT_DEVELOPER_HOME_LEAK: "1" } }),
      "utf8",
    );
    fsSync.writeFileSync(
      path.join(dirtyHome, ".claude.json"),
      JSON.stringify({
        projects: { [fixtureProject]: { hasTrustDialogAccepted: true } },
      }),
      "utf8",
    );

    try {
      // The plant is real: a run that reads that home records both of them.
      const leaked = await runGoldenFixture("environment", {
        homeDir: dirtyHome,
      });
      const leakedEnvironment = leaked.actual.discovery.environment as {
        relevant: Array<{ key: string }>;
      };
      expect(leakedEnvironment.relevant.map((entry) => entry.key)).toContain(
        "CAPSIGHT_DEVELOPER_HOME_LEAK",
      );
      expect(leaked.actual.discovery.trust).toEqual({
        accepted: true,
        projectPath: ".",
      });

      // The fixture runner reads its own home, so the same plant — reachable
      // through the ambient `$HOME` — cannot change the result.
      process.env.HOME = dirtyHome;
      process.env.USERPROFILE = dirtyHome;
      const isolated = await runGoldenFixture("environment");
      expect(isolated.actual).toEqual(isolated.expected);
    } finally {
      fsSync.rmSync(dirtyHome, { recursive: true, force: true });
    }
  });

  // §11.2/§13 invariant 2, second leak of the H1-22 class: `walkProjectScopes`
  // climbs until it finds a directory containing `.git`, and a fixture tree
  // carries none, so a fixture run walked into the Capsight checkout and read
  // this repository's own `.claude/agents/`. Adding `reviewer.md` there
  // collided with `add-dir`'s own `reviewer` agent (A1) and broke five
  // goldens. The run now gives each fixture project its own repository root
  // (`tests/fixtures/global-setup.ts`), so nothing above `project/` is reached.
  it("keeps an agent declared above the fixture project out of a golden", async () => {
    const fixtureDir = path.join(FIXTURES_ROOT, "add-dir");
    // Same name and shape as Capsight's own `.claude/agents/reviewer.md`,
    // planted directly above `project/` — where the checkout's own scope sat.
    const plant = (root: string): void => {
      const agentsDir = path.join(root, ".claude", "agents");
      fsSync.mkdirSync(agentsDir, { recursive: true });
      fsSync.writeFileSync(
        path.join(agentsDir, "reviewer.md"),
        "---\nname: reviewer\ndescription: Ambient agent that must not be seen.\ntools: Read\n---\n\nPlanted by the test.\n",
        "utf8",
      );
    };

    // The plant is real: on a copy without the repo-root marker the walk
    // reaches the ancestor, and the planted `reviewer` collides with the
    // fixture's own — the exact failure this repository's `reviewer.md` caused.
    const leaky = materializeUnisolatedFixture(fixtureDir);
    plant(leaky);
    await expect(
      runGoldenFixture("add-dir", { fixtureDir: leaky }),
    ).rejects.toThrow(/agent reviewer is declared by 2 entries/);

    // The same plant one level above an *isolated* fixture cannot be seen.
    // Planted into a relocated copy rather than into the corpus: a run killed
    // between the plant and its cleanup would otherwise leave an untracked
    // `.claude/agents/reviewer.md` inside the checked-out corpus, where an
    // unrelated `git add -A` could commit it. The copy carries the marker
    // `global-setup.ts` created, so `materializeFixtureAtCheckout` also fails
    // loudly if the isolation hook did not run.
    assertFixtureIsolated(fixtureDir);
    const isolated = materializeFixtureAtCheckout(fixtureDir, CHECKOUT_SHAPES[0]);
    plant(isolated);
    const { actual, expected } = await runGoldenFixture("add-dir", {
      fixtureDir: isolated,
    });
    expect(actual).toEqual(expected);
  });

  // §11.2: two test runs sharing one working tree. Marker creation is
  // idempotent, so run B reuses run A's marker; if A's teardown then removed
  // it unconditionally, B would lose isolation mid-scan and read the Capsight
  // checkout — the failure this hook exists to prevent, arriving as a flake.
  // Each run holds a claim inside the marker and the last one out removes it.
  it("does not strip a concurrent run's repo-root markers", async () => {
    const workspace = fsSync.mkdtempSync(
      path.join(os.tmpdir(), "capsight-concurrent-runs-"),
    );
    const projectRoot = path.join(workspace, "fixture", "project");
    fsSync.mkdirSync(projectRoot, { recursive: true });
    const marker = path.join(projectRoot, ".git");
    const ready = path.join(workspace, "ready");
    const go = path.join(workspace, "go");

    // Run B is a real second process, holding its lease across run A's teardown.
    const probe = path.join(workspace, "probe.ts");
    const runtimeModule = path.join(__dirname, "fixture-runtime.ts");
    fsSync.writeFileSync(
      probe,
      [
        `import fs from "node:fs";`,
        `import { acquireFixtureRepoRoots, releaseFixtureRepoRoots } from ${JSON.stringify(runtimeModule)};`,
        `const lease = acquireFixtureRepoRoots([${JSON.stringify(projectRoot)}]);`,
        `fs.writeFileSync(${JSON.stringify(ready)}, "", "utf8");`,
        `const wait = setInterval(() => {`,
        `  if (!fs.existsSync(${JSON.stringify(go)})) return;`,
        `  clearInterval(wait);`,
        `  releaseFixtureRepoRoots(lease);`,
        `}, 10);`,
      ].join("\n"),
      "utf8",
    );

    const waitFor = async (target: string): Promise<void> => {
      for (let attempt = 0; attempt < 1000; attempt += 1) {
        if (fsSync.existsSync(target)) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      throw new Error(`timed out waiting for ${target}`);
    };

    const runA = acquireFixtureRepoRoots([projectRoot]);
    const child = spawn(
      process.execPath,
      ["--import", "tsx", probe],
      { stdio: "ignore" },
    );
    const exited = new Promise<number | null>((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", (code) => resolve(code));
    });

    try {
      await waitFor(ready);
      expect(fsSync.existsSync(marker)).toBe(true);

      // Run A finishes while run B is still scanning.
      releaseFixtureRepoRoots(runA);
      expect(
        fsSync.existsSync(marker),
        "run A's teardown stripped the marker run B is relying on",
      ).toBe(true);

      // Run B finishes: the last claim gone, the marker goes with it.
      fsSync.writeFileSync(go, "", "utf8");
      expect(await exited).toBe(0);
      expect(fsSync.existsSync(marker)).toBe(false);
    } finally {
      child.kill();
      fsSync.rmSync(workspace, { recursive: true, force: true });
    }
  }, 30_000);

  // A claim outlives its owner whenever a run dies without tearing down: a
  // SIGKILL, or the SIGPIPE that `vitest ... | head` delivers when the pipe
  // closes. Nothing reaped those claims, so one zero-byte leftover pinned a
  // marker forever — and because the isolation assertions only asked whether
  // the marker existed, a pinned marker made all of them pass with the
  // isolation hook removed entirely. The guard could no longer observe what it
  // guarded (H1-07). A dead run's claim must not hold a marker open.
  it("reaps a dead run's claim instead of pinning the marker forever", async () => {
    const workspace = fsSync.mkdtempSync(
      path.join(os.tmpdir(), "capsight-stale-claim-"),
    );
    const projectRoot = path.join(workspace, "fixture", "project");
    const marker = path.join(projectRoot, ".git");
    fsSync.mkdirSync(marker, { recursive: true });

    // A real pid that is really gone, rather than a number assumed unused.
    const corpse = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
    const deadPid = await new Promise<number>((resolve, reject) => {
      corpse.on("error", reject);
      corpse.on("exit", () => resolve(corpse.pid!));
    });
    const stale = path.join(marker, `capsight-run-${deadPid}-stale`);
    fsSync.writeFileSync(stale, "", "utf8");

    try {
      // The next run reaps it, so its own teardown can still free the marker.
      const lease = acquireFixtureRepoRoots([projectRoot]);
      expect(fsSync.existsSync(stale)).toBe(false);
      releaseFixtureRepoRoots(lease);
      expect(
        fsSync.existsSync(marker),
        "a dead run's claim kept the marker pinned",
      ).toBe(false);
    } finally {
      fsSync.rmSync(workspace, { recursive: true, force: true });
    }
  }, 30_000);

  // ...and the isolation assertion must reject that leftover too, otherwise
  // reaping only narrows the window: a marker present but unclaimed by this
  // run proves nothing about whether the hook ran. Both modes are pinned down
  // here, so the meaning does not depend on how the suite was invoked.
  it("rejects a marker no live run holds a claim on", async () => {
    const workspace = fsSync.mkdtempSync(
      path.join(os.tmpdir(), "capsight-orphan-marker-"),
    );
    const fixtureDir = path.join(workspace, "fixture");
    const marker = path.join(fixtureDir, "project", ".git");
    fsSync.mkdirSync(marker, { recursive: true });
    const publishedRunId = process.env[FIXTURE_RUN_ID_ENV];
    expect(
      publishedRunId,
      "global-setup must publish its run id to the workers",
    ).toBeTypeOf("string");

    // A pid that is really gone, for the no-run-id fallback below.
    const corpse = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
    const deadPid = await new Promise<number>((resolve, reject) => {
      corpse.on("error", reject);
      corpse.on("exit", () => resolve(corpse.pid!));
    });

    try {
      // A bare marker, exactly what an interrupted run leaves behind.
      expect(() => assertFixtureIsolated(fixtureDir)).toThrow(
        /no live repo-root claim/,
      );

      // With a run id published, another run's claim is not this run's claim,
      // however alive that other run is.
      vi.stubEnv(FIXTURE_RUN_ID_ENV, "this-run");
      const foreign = path.join(marker, `capsight-run-${process.pid}-other`);
      fsSync.writeFileSync(foreign, "", "utf8");
      expect(() => assertFixtureIsolated(fixtureDir)).toThrow(
        /no live repo-root claim/,
      );

      // This run's own claim satisfies it.
      fsSync.writeFileSync(path.join(marker, "capsight-run-this-run"), "", "utf8");
      expect(() => assertFixtureIsolated(fixtureDir)).not.toThrow();

      // Without a published run id the fallback asks for a live owner, so a
      // dead run's leftover still fails and a live run's claim still passes.
      delete process.env[FIXTURE_RUN_ID_ENV];
      fsSync.rmSync(path.join(marker, "capsight-run-this-run"), { force: true });
      fsSync.rmSync(foreign, { force: true });
      fsSync.writeFileSync(
        path.join(marker, `capsight-run-${deadPid}-stale`),
        "",
        "utf8",
      );
      expect(() => assertFixtureIsolated(fixtureDir)).toThrow(
        /no live repo-root claim/,
      );
      fsSync.writeFileSync(foreign, "", "utf8");
      expect(() => assertFixtureIsolated(fixtureDir)).not.toThrow();
    } finally {
      if (publishedRunId !== undefined) {
        process.env[FIXTURE_RUN_ID_ENV] = publishedRunId;
      }
      fsSync.rmSync(workspace, { recursive: true, force: true });
    }
  }, 30_000);

  // §11.2/§13 invariant 2, third leak of the H1-22 class: an instruction id is
  // `sha256("instruction:" + absolute path)` (`discovery/instructions.ts`), and
  // `sortCapabilities` used to break ties on that id, so the recorded order of
  // the `instructions` fixture was a function of where the repository happened
  // to be checked out. It reproduced at `/home/user/capsight` and reordered at
  // `/home/runner/work/capsight/capsight`, which is where GitHub Actions checks
  // out — the corpus could not have gone green in CI. The order now comes from
  // the project-relative source path, so replaying the fixture from unrelated
  // roots must reproduce the recorded golden byte for byte.
  it("records the same golden from unrelated absolute checkout paths", async () => {
    const fixtureDir = path.join(FIXTURES_ROOT, "instructions");
    const orders: string[][] = [];

    for (const shape of CHECKOUT_SHAPES) {
      const relocated = materializeFixtureAtCheckout(fixtureDir, shape);
      const { actual, expected } = await runGoldenFixture("instructions", {
        fixtureDir: relocated,
      });
      expect(actual, `golden differs at ${shape}`).toEqual(expected);
      orders.push(
        actual.resolutions[0]!.capabilities
          .filter((capability) => capability.kind === "instruction")
          .map((capability) => capability.capabilityId),
      );
    }

    // Three instruction sources, so the tie-break is actually exercised: two
    // in the project root and one in the `app/` scope the fixture scans from.
    for (const order of orders) {
      expect(order).toEqual([
        "instruction:CLAUDE.local.md",
        "instruction:CLAUDE.md",
        "instruction:app/CLAUDE.md",
      ]);
    }
  });

  // A4 documents no rule for which colliding file loads, so the order the scan
  // reports candidates in must not reach the golden.
  for (const fixtureName of ["collision-same-dir", "collision-nested"]) {
    it(`resolves claude/${fixtureName} identically with the candidate order reversed`, async () => {
      const forward = await runGoldenFixture(fixtureName);
      expect(forward.actual).toEqual(forward.expected);

      const reversed = await runGoldenFixture(fixtureName, {
        mutateSnapshot: reverseCandidateOrder,
      });
      expect(reversed.actual).toEqual(forward.actual);
    });
  }

  // Fixtures from the declared SPEC §11.1 corpus that do not yet satisfy the
  // §11.2 contract are surfaced as todos instead of being silently skipped.
  for (const status of inspectFixtureCorpus(
    FIXTURES_ROOT,
    CLAUDE_FIXTURE_NAMES,
  )) {
    if (status.completeness === "complete") {
      continue;
    }
    it.todo(
      `pending fixture claude/${status.name} (${status.completeness}; missing ${status.missingEntries.join(", ")})`,
    );
  }
});

console.warn(
  formatPendingFixtures(inspectFixtureCorpus(FIXTURES_ROOT, CLAUDE_FIXTURE_NAMES)),
);
