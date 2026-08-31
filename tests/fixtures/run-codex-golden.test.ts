import fsSync from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import type {
  EffectiveConfiguration,
  PlatformVersion,
} from "../../src/core/model/index.js";
import { buildExecutionContext } from "../../src/adapters/codex/resolution/context.js";
import type { ContextPreset } from "../../src/core/model/index.js";
import type { FeatureCompatibility } from "../../src/adapters/codex/version/matrix.js";
import { VERSION_MATRIX } from "../../src/adapters/codex/version/matrix.js";
import {
  normalizeGoldenOutput,
  type NormalizedGoldenOutput,
} from "./golden-normalize.js";
import { resolveFixtureScanPath } from "./coverage-report.js";
import {
  CHECKOUT_SHAPES,
  assertFixtureIsolated,
  cleanupFixtureHome,
  cleanupRelocatedCheckouts,
  cleanupUnisolatedFixtures,
  fixtureHomeDir,
  materializeFixtureAtCheckout,
  materializeUnisolatedFixture,
  restoreProcessEnv,
  selectFixtureAgent,
  resolveFixtureHomeDir,
} from "./fixture-runtime.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = path.join(__dirname, "codex");

const { mockDetectCodexVersion } = vi.hoisted(() => ({
  mockDetectCodexVersion: vi.fn<() => Promise<PlatformVersion>>(),
}));

vi.mock("../../src/adapters/codex/version/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/adapters/codex/version/index.js")>();
  return {
    ...actual,
    detectCodexVersion: mockDetectCodexVersion,
    defaultCommandRunner: { run: vi.fn() },
  };
});

interface FixtureContextSpec {
  agentName: string;
  agentSourcePath?: string;
  preset: ContextPreset;
  depth?: number;
  maxDepth?: number;
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

function applyFixtureEnv(
  env: Record<string, string>,
  fixtureDir: string,
  homeDirOverride?: string,
): void {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("CODEX_")) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
  const home = resolveFixtureHomeDir(fixtureDir, homeDirOverride);
  vi.stubEnv("HOME", home);
  vi.stubEnv("USERPROFILE", home);
  vi.stubEnv("CODEX_HOME", path.join(home, ".codex"));
}

async function runGoldenFixture(
  fixtureName: string,
  /** Fixture directory to read instead of the corpus one (isolation tests). */
  fixtureDirOverride?: string,
): Promise<{
  actual: NormalizedGoldenOutput;
  expected: NormalizedGoldenOutput;
  /**
   * Raw snapshot, before normalization. The isolation test asserts on it
   * because `normalizeGoldenOutput` drops every entry outside the project, so
   * an ancestor file a scan wrongly read is invisible in the golden itself.
   */
  instructionPaths: string[];
}> {
  const fixtureDir = fixtureDirOverride ?? path.join(FIXTURES_ROOT, fixtureName);
  const projectRoot = path.join(fixtureDir, "project");
  const contract = await loadFixtureContract(fixtureDir);
  const expected = JSON.parse(
    await fsPromises.readFile(path.join(fixtureDir, "expected.json"), "utf8"),
  ) as NormalizedGoldenOutput;

  applyFixtureEnv(contract.env, fixtureDir);
  mockDetectCodexVersion.mockResolvedValue({
    platform: "codex",
    version: contract.version,
    raw: `codex-cli ${contract.version}`,
    detectedAt: "1970-01-01T00:00:00.000Z",
  });

  const { scan } = await import("../../src/application/scan.js");
  const { resolve } = await import("../../src/application/resolve.js");

  const scanResult = await scan({
    projectPath: resolveFixtureScanPath(fixtureDir),
    platform: "codex",
  });

  const resolutions: Array<{ agentName: string; resolution: EffectiveConfiguration }> = [];

  for (const contextSpec of contract.contexts) {
    const agent = selectFixtureAgent(scanResult.snapshot.agents, contextSpec, projectRoot);
    const context = buildExecutionContext(contextSpec.preset, {
      ...(contextSpec.depth !== undefined ? { depth: contextSpec.depth } : {}),
      ...(contextSpec.maxDepth !== undefined ? { maxDepth: contextSpec.maxDepth } : {}),
    });
    const resolution = await resolve({
      snapshot: scanResult.snapshot,
      agentId: agent.id,
      context,
    });
    resolutions.push({ agentName: contextSpec.agentName, resolution });
  }

  const actual = normalizeGoldenOutput(
    scanResult.snapshot,
    resolutions,
    projectRoot,
  );
  return {
    actual,
    expected,
    instructionPaths: (
      scanResult.snapshot.instructions as Array<{ path: string }>
    ).map((instruction) => instruction.path),
  };
}

async function withMatrixPatch(
  id: string,
  patch: Partial<FeatureCompatibility>,
  body: () => Promise<void>,
): Promise<void> {
  const entry = VERSION_MATRIX.find((candidate) => candidate.id === id)!;
  const original = { ...entry };
  Object.assign(entry, patch);
  try {
    await body();
  } finally {
    for (const key of Object.keys(entry) as Array<keyof FeatureCompatibility>) {
      delete (entry as unknown as Record<string, unknown>)[key];
    }
    Object.assign(entry, original);
  }
}

describe("codex golden fixtures", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    vi.unstubAllEnvs();
    restoreProcessEnv(envSnapshot);
    mockDetectCodexVersion.mockReset();
  });

  afterAll(() => {
    cleanupFixtureHome();
    cleanupUnisolatedFixtures();
    cleanupRelocatedCheckouts();
  });

  it("matches expected discovery and resolution for codex/basic", async () => {
    const { actual, expected } = await runGoldenFixture("basic");
    expect(actual).toEqual(expected);
  });

  for (const fixtureName of [
    "agents-precedence",
    "nested-instructions",
    "trust-untrusted",
    "instruction-fallback",
  ] as const) {
    it(`matches expected discovery and resolution for codex/${fixtureName}`, async () => {
      const { actual, expected } = await runGoldenFixture(fixtureName);
      expect(actual).toEqual(expected);
    });
  }

  // §8.4 / G1-MP-02: version above a supported rule's matrix maxVersion downgrades
  // only the capabilities that rule gates — not the whole resolution.
  it("version-drift scopes downgrade when the detected version exceeds a matrix maxVersion", async () => {
    const { actual, expected } = await runGoldenFixture("version-drift");
    expect(actual).toEqual(expected);

    const settingsLayer = actual.discovery.settings[0] as {
      unknownFields?: Record<string, string>;
    };
    expect(settingsLayer?.unknownFields).toBeUndefined();

    expect(actual.resolutions[0]!.capabilities[0]).toMatchObject({
      capabilityId: "instruction:AGENTS.md",
      status: "available",
      enforcement: "enforced",
    });

    await withMatrixPatch("settings.knownKeysOnly", { maxVersion: undefined }, async () => {
      const withoutBound = await runGoldenFixture("version-drift");
      const restoredLayer = withoutBound.actual.discovery.settings[0] as {
        unknownFields?: Record<string, string>;
      };
      expect(restoredLayer?.unknownFields).toEqual({
        experimental_feature_enabled: "boolean",
      });
    });
  });

  // §11.2/§13 invariant 2. Codex's `walkProjectScopes` climbs until it finds a
  // directory containing `.git`, exactly like Claude's, so a codex fixture scan
  // reads every `AGENTS.md` between `project/` and the Capsight checkout unless
  // the isolation hook gives it a repo root. The codex golden passed
  // identically with and without that hook (H1-07), for two reasons, and both
  // are asserted here rather than assumed:
  //
  //  - the hook must actually have run for this corpus, and
  //  - the leak is real but *invisible in the golden*: `normalizeGoldenOutput`
  //    drops every discovery entry and capability outside the project, so the
  //    ancestor file shows up only in the raw snapshot. It is asserted there.
  it("reads nothing above the fixture project", async () => {
    const fixtureDir = path.join(FIXTURES_ROOT, "basic");
    const plant = (root: string): void => {
      fsSync.writeFileSync(
        path.join(root, "AGENTS.md"),
        "# Ambient instructions\n\nPlanted by the test; must not be seen.\n",
        "utf8",
      );
    };
    const outsideProject = (
      run: { instructionPaths: string[] },
      projectRoot: string,
    ): string[] =>
      run.instructionPaths.filter((candidate) =>
        path.relative(projectRoot, candidate).startsWith(".."),
      );

    // The plant is real: with no repo-root marker the walk reaches the
    // ancestor and its AGENTS.md joins the instruction chain.
    const leaky = materializeUnisolatedFixture(fixtureDir);
    plant(leaky);
    const leaked = await runGoldenFixture("basic", leaky);
    expect(outsideProject(leaked, path.join(leaky, "project"))).toEqual([
      path.join(leaky, "AGENTS.md"),
    ]);

    // Fails when `globalSetup` is disabled or the corpus root moves.
    assertFixtureIsolated(fixtureDir);

    // With the marker the hook created, the same plant is unreachable and the
    // scan stays inside the fixture project.
    const isolated = materializeFixtureAtCheckout(fixtureDir, CHECKOUT_SHAPES[0]);
    plant(isolated);
    const run = await runGoldenFixture("basic", isolated);
    expect(outsideProject(run, path.join(isolated, "project"))).toEqual([]);
    expect(run.actual).toEqual(run.expected);

    // And the corpus fixture itself, as every other codex test scans it.
    const corpus = await runGoldenFixture("basic");
    expect(outsideProject(corpus, path.join(fixtureDir, "project"))).toEqual([]);
  });
});
