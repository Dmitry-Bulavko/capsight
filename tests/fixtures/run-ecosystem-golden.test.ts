import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformVersion } from "../../src/core/model/index.js";
import { clearLastScan } from "../../src/application/scan-store.js";
import {
  ECOSYSTEM_FIXTURES_ROOT,
  ECOSYSTEM_MCP_SECRET,
  applyEcosystemFixtureProcessEnv,
  runEcosystemGoldenFixture,
} from "./ecosystem-golden-runner.js";
import {
  assertFixtureIsolated,
  CHECKOUT_SHAPES,
  cleanupFixtureHome,
  cleanupRelocatedCheckouts,
  materializeFixtureAtCheckout,
  restoreProcessEnv,
} from "./fixture-runtime.js";

const FIXTURE_NAME = "mixed";

const { mockDetectClaudeVersion, mockDetectCursorVersion, mockDetectCodexVersion } =
  vi.hoisted(() => ({
    mockDetectClaudeVersion: vi.fn<() => Promise<PlatformVersion>>(),
    mockDetectCursorVersion: vi.fn<() => Promise<PlatformVersion>>(),
    mockDetectCodexVersion: vi.fn<() => Promise<PlatformVersion>>(),
  }));

vi.mock("../../src/adapters/claude/version/index.js", () => ({
  detectClaudeVersion: mockDetectClaudeVersion,
  defaultCommandRunner: { run: vi.fn() },
}));

vi.mock("../../src/adapters/cursor/version/index.js", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../src/adapters/cursor/version/index.js")
  >();
  return {
    ...actual,
    detectCursorVersion: mockDetectCursorVersion,
    defaultCommandRunner: { run: vi.fn() },
  };
});

vi.mock("../../src/adapters/codex/version/index.js", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../src/adapters/codex/version/index.js")
  >();
  return {
    ...actual,
    detectCodexVersion: mockDetectCodexVersion,
    defaultCommandRunner: { run: vi.fn() },
  };
});

const versionMocks = {
  mockDetectClaudeVersion,
  mockDetectCursorVersion,
  mockDetectCodexVersion,
};

describe("ecosystem golden fixtures", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    clearLastScan();
    vi.unstubAllEnvs();
    restoreProcessEnv(envSnapshot);
    mockDetectClaudeVersion.mockReset();
    mockDetectCursorVersion.mockReset();
    mockDetectCodexVersion.mockReset();
  });

  afterAll(() => {
    cleanupFixtureHome();
    cleanupRelocatedCheckouts();
  });

  it(`matches expected detection, inventory, overlaps and compat for ecosystem/${FIXTURE_NAME}`, async () => {
    const fixtureDir = path.join(ECOSYSTEM_FIXTURES_ROOT, FIXTURE_NAME);
    assertFixtureIsolated(fixtureDir);

    const { actual, expected } = await runEcosystemGoldenFixture(
      FIXTURE_NAME,
      versionMocks,
    );
    expect(actual, JSON.stringify(actual, null, 2)).toEqual(expected);
  });

  it("never surfaces MCP env values in the normalized inventory output", async () => {
    const { actual } = await runEcosystemGoldenFixture(FIXTURE_NAME, versionMocks);
    const serialized = JSON.stringify(actual);
    expect(serialized).not.toContain(ECOSYSTEM_MCP_SECRET);
  });

  it("records the same golden from unrelated absolute checkout paths", async () => {
    const fixtureDir = path.join(ECOSYSTEM_FIXTURES_ROOT, FIXTURE_NAME);
    assertFixtureIsolated(fixtureDir);

    for (const shape of CHECKOUT_SHAPES) {
      const relocated = materializeFixtureAtCheckout(fixtureDir, shape);
      const { actual, expected } = await runEcosystemGoldenFixture(FIXTURE_NAME, versionMocks, {
        fixtureDirOverride: relocated,
      });
      expect(actual, `golden differs at ${shape}`).toEqual(expected);
    }
  });

  it("keeps the developer's real home directories out of a golden", async () => {
    const dirtyHome = fsSync.mkdtempSync(path.join(os.tmpdir(), "capsight-dirty-home-"));
    const plantPath = path.join(dirtyHome, ".claude", "agents", "ambient-leak.md");

    fsSync.mkdirSync(path.dirname(plantPath), { recursive: true });
    fsSync.writeFileSync(
      plantPath,
      "---\nname: ambient-leak\ndescription: Must not appear\ntools: Read\n---\n",
      "utf8",
    );

    try {
      const leaked = await runEcosystemGoldenFixture(FIXTURE_NAME, versionMocks, {
        homeDir: dirtyHome,
      });
      expect(
        leaked.actual.resources.agent.some((resource) => resource.name === "ambient-leak"),
      ).toBe(true);

      const isolated = await runEcosystemGoldenFixture(FIXTURE_NAME, versionMocks);
      expect(isolated.actual).toEqual(isolated.expected);
    } finally {
      fsSync.rmSync(dirtyHome, { recursive: true, force: true });
    }
  });
});
