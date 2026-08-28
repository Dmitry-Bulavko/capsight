import fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  EffectiveConfiguration,
  PlatformVersion,
} from "../../src/core/model/index.js";
import { buildExecutionContext } from "../../src/core/resolver/context.js";
import type { ContextPreset } from "../../src/core/model/index.js";
import {
  discoverFixtureNames,
  formatPendingFixtures,
  inspectFixtureCorpus,
} from "./coverage-report.js";
import {
  normalizeGoldenOutput,
  type NormalizedGoldenOutput,
} from "./golden-normalize.js";

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
  preset: ContextPreset;
  depth?: number;
  maxDepth?: number;
  parentPermissionMode?: EffectiveConfiguration["context"]["parentPermissionMode"];
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

function applyFixtureEnv(env: Record<string, string>): void {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("CLAUDE_")) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
}

async function runGoldenFixture(fixtureName: string): Promise<void> {
  const fixtureDir = path.join(FIXTURES_ROOT, fixtureName);
  const projectRoot = path.join(fixtureDir, "project");
  const contract = await loadFixtureContract(fixtureDir);
  const expected = JSON.parse(
    await fsPromises.readFile(path.join(fixtureDir, "expected.json"), "utf8"),
  ) as NormalizedGoldenOutput;

  applyFixtureEnv(contract.env);
  mockDetectClaudeVersion.mockResolvedValue({
    platform: "claude",
    version: contract.version,
    raw: contract.version,
    detectedAt: "1970-01-01T00:00:00.000Z",
  });

  const { scan } = await import("../../src/application/scan.js");
  const { resolve } = await import("../../src/application/resolve.js");

  const scanResult = await scan({ projectPath: projectRoot });
  const resolutions: Array<{ agentName: string; resolution: EffectiveConfiguration }> =
    [];

  for (const contextSpec of contract.contexts) {
    const agent = scanResult.snapshot.agents.find(
      (entry) => entry.name === contextSpec.agentName,
    );
    expect(agent, `agent ${contextSpec.agentName} should exist`).toBeDefined();

    const context = buildExecutionContext(contextSpec.preset, {
      ...(contextSpec.depth !== undefined ? { depth: contextSpec.depth } : {}),
      ...(contextSpec.maxDepth !== undefined ? { maxDepth: contextSpec.maxDepth } : {}),
      ...(contextSpec.parentPermissionMode !== undefined
        ? { parentPermissionMode: contextSpec.parentPermissionMode }
        : {}),
    });

    const resolution = await resolve({
      snapshot: scanResult.snapshot,
      agentId: agent!.id,
      context,
    });

    resolutions.push({ agentName: contextSpec.agentName, resolution });
  }

  const actual = normalizeGoldenOutput(scanResult.snapshot, resolutions, projectRoot);
  expect(actual).toEqual(expected);
}

describe("golden fixtures", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
    vi.unstubAllEnvs();
    mockDetectClaudeVersion.mockReset();
  });

  for (const fixtureName of discoverFixtureNames(FIXTURES_ROOT)) {
    it(`matches expected discovery and resolution for claude/${fixtureName}`, async () => {
      await runGoldenFixture(fixtureName);
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
