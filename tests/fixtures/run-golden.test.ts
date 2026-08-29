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
  cleanupFixtureHome,
  fixtureHomeDir,
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
}

async function runGoldenFixture(
  fixtureName: string,
  options: RunGoldenOptions = {},
): Promise<{ actual: NormalizedGoldenOutput; expected: NormalizedGoldenOutput }> {
  const fixtureDir = path.join(FIXTURES_ROOT, fixtureName);
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
  });

  for (const fixtureName of discoverFixtureNames(FIXTURES_ROOT)) {
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
  for (const status of inspectFixtureCorpus(FIXTURES_ROOT)) {
    if (status.completeness === "complete") {
      continue;
    }
    it.todo(
      `pending fixture claude/${status.name} (${status.completeness}; missing ${status.missingEntries.join(", ")})`,
    );
  }
});

console.warn(formatPendingFixtures(inspectFixtureCorpus(FIXTURES_ROOT)));
