import fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import type {
  EffectiveConfiguration,
  PlatformVersion,
} from "../../src/core/model/index.js";
import { buildExecutionContext } from "../../src/adapters/cursor/resolution/context.js";
import type { ContextPreset } from "../../src/core/model/index.js";
import {
  normalizeGoldenOutput,
  type NormalizedGoldenOutput,
} from "./golden-normalize.js";
import {
  CHECKOUT_SHAPES,
  cleanupFixtureHome,
  cleanupRelocatedCheckouts,
  fixtureHomeDir,
  materializeFixtureAtCheckout,
  restoreProcessEnv,
  selectFixtureAgent,
} from "./fixture-runtime.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = path.join(__dirname, "cursor");

const { mockDetectCursorVersion } = vi.hoisted(() => ({
  mockDetectCursorVersion: vi.fn<() => Promise<PlatformVersion>>(),
}));

vi.mock("../../src/adapters/cursor/version/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/adapters/cursor/version/index.js")>();
  return {
    ...actual,
    detectCursorVersion: mockDetectCursorVersion,
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

function applyFixtureEnv(env: Record<string, string>, homeDir?: string): void {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("CURSOR_")) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
  const home = homeDir ?? fixtureHomeDir();
  vi.stubEnv("HOME", home);
  vi.stubEnv("USERPROFILE", home);
}

async function runGoldenFixture(
  fixtureName: string,
  /** Fixture directory to read instead of the corpus one (relocation test). */
  fixtureDirOverride?: string,
): Promise<{ actual: NormalizedGoldenOutput; expected: NormalizedGoldenOutput }> {
  const fixtureDir = fixtureDirOverride ?? path.join(FIXTURES_ROOT, fixtureName);
  const projectRoot = path.join(fixtureDir, "project");
  const contract = await loadFixtureContract(fixtureDir);
  const expected = JSON.parse(
    await fsPromises.readFile(path.join(fixtureDir, "expected.json"), "utf8"),
  ) as NormalizedGoldenOutput;

  applyFixtureEnv(contract.env);
  mockDetectCursorVersion.mockResolvedValue({
    platform: "cursor",
    version: contract.version,
    raw: contract.version,
    detectedAt: "1970-01-01T00:00:00.000Z",
  });

  const { scan } = await import("../../src/application/scan.js");
  const { resolve } = await import("../../src/application/resolve.js");

  const scanResult = await scan({
    projectPath: projectRoot,
    platform: "cursor",
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
  return { actual, expected };
}

describe("cursor golden fixtures", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    vi.unstubAllEnvs();
    restoreProcessEnv(envSnapshot);
    mockDetectCursorVersion.mockReset();
  });

  afterAll(() => {
    cleanupFixtureHome();
    cleanupRelocatedCheckouts();
  });

  it("matches expected discovery and resolution for cursor/basic", async () => {
    const { actual, expected } = await runGoldenFixture("basic");
    expect(actual).toEqual(expected);
  });

  // The claude corpus ordered instruction capabilities by an id derived from
  // the absolute file path, which made the recorded order a function of the
  // checkout location (D1-09). `cursor/basic` carries two instruction
  // capabilities, so it is checked for the same exposure rather than assumed
  // clear: its ids are `instruction:<type>:<basename>` and the capability list
  // keeps discovery order, but only a replay from unrelated roots shows it.
  it("records the same golden from unrelated absolute checkout paths", async () => {
    for (const shape of CHECKOUT_SHAPES) {
      const relocated = materializeFixtureAtCheckout(
        path.join(FIXTURES_ROOT, "basic"),
        shape,
      );
      const { actual, expected } = await runGoldenFixture("basic", relocated);
      expect(actual, `golden differs at ${shape}`).toEqual(expected);
    }
  });
});
