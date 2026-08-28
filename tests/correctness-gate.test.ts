import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  EffectiveConfiguration,
  PlatformVersion,
} from "../src/core/model/index.js";
import { buildExecutionContext } from "../src/core/resolver/context.js";
import type { ContextPreset } from "../src/core/model/index.js";
import {
  buildCoverageReport,
  discoverFixtureNames,
  findConfidentCapabilityMismatches,
  formatCoverageReport,
  isConfidentCapabilityStatus,
  FIXTURES_ROOT,
} from "./fixtures/coverage-report.js";
import {
  normalizeGoldenOutput,
  type NormalizedGoldenOutput,
} from "./fixtures/golden-normalize.js";

const { mockDetectClaudeVersion } = vi.hoisted(() => ({
  mockDetectClaudeVersion: vi.fn<() => Promise<PlatformVersion>>(),
}));

vi.mock("../src/adapters/claude/version/index.js", () => ({
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

async function runFixtureToGolden(
  fixtureName: string,
): Promise<{ actual: NormalizedGoldenOutput; expected: NormalizedGoldenOutput }> {
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

  const { scan } = await import("../src/application/scan.js");
  const { resolve } = await import("../src/application/resolve.js");

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
  return { actual, expected };
}

function emptyGolden(agentName: string): NormalizedGoldenOutput {
  return {
    discovery: {
      agents: [],
      skills: [],
      instructions: [],
      mcpServers: [],
      settings: [],
      trust: { accepted: false, projectPath: "." },
      environment: { relevant: [] },
    },
    resolutions: [
      {
        agentName,
        context: {
          preset: "background-subagent",
          isMainSession: false,
          isBackground: true,
          isFork: false,
          isTeammate: false,
          depth: 0,
          maxDepth: 3,
        },
        capabilities: [],
        warnings: [],
        unknownRate: 0,
      },
    ],
  };
}

describe("correctness gate rules", () => {
  it("treats unknown actual status as non-blocking", () => {
    const expected = emptyGolden("agent");
    expected.resolutions[0]!.capabilities = [
      {
        capabilityId: "Read",
        kind: "tool",
        status: "denied",
        enforcement: "enforced",
        sources: [],
        reasons: [],
      },
    ];

    const actual = emptyGolden("agent");
    actual.resolutions[0]!.capabilities = [
      {
        capabilityId: "Read",
        kind: "tool",
        status: "unknown",
        enforcement: "unknown",
        sources: [],
        reasons: [],
      },
    ];

    expect(
      findConfidentCapabilityMismatches(actual, expected, "sample"),
    ).toEqual([]);
  });

  it("passes when confident status matches golden expectation", () => {
    const expected = emptyGolden("agent");
    expected.resolutions[0]!.capabilities = [
      {
        capabilityId: "Read",
        kind: "tool",
        status: "denied",
        enforcement: "enforced",
        sources: [],
        reasons: [],
      },
    ];

    const actual = structuredClone(expected);
    expect(
      findConfidentCapabilityMismatches(actual, expected, "sample"),
    ).toEqual([]);
  });

  it("fails when confident status differs from golden expectation", () => {
    const expected = emptyGolden("agent");
    expected.resolutions[0]!.capabilities = [
      {
        capabilityId: "Read",
        kind: "tool",
        status: "denied",
        enforcement: "enforced",
        sources: [],
        reasons: [],
      },
    ];

    const actual = emptyGolden("agent");
    actual.resolutions[0]!.capabilities = [
      {
        capabilityId: "Read",
        kind: "tool",
        status: "available",
        enforcement: "enforced",
        sources: [],
        reasons: [],
      },
    ];

    expect(
      findConfidentCapabilityMismatches(actual, expected, "sample"),
    ).toEqual([
      {
        fixtureName: "sample",
        agentName: "agent",
        capabilityId: "Read",
        actualStatus: "available",
        expectedStatus: "denied",
      },
    ]);
  });

  it("fails when confident capability is absent from golden expectation", () => {
    const expected = emptyGolden("agent");
    const actual = emptyGolden("agent");
    actual.resolutions[0]!.capabilities = [
      {
        capabilityId: "Grep",
        kind: "tool",
        status: "available",
        enforcement: "enforced",
        sources: [],
        reasons: [],
      },
    ];

    expect(
      findConfidentCapabilityMismatches(actual, expected, "sample"),
    ).toEqual([
      {
        fixtureName: "sample",
        agentName: "agent",
        capabilityId: "Grep",
        actualStatus: "available",
        expectedStatus: undefined,
      },
    ]);
  });

  it("classifies confident vs unknown statuses explicitly", () => {
    expect(isConfidentCapabilityStatus("unknown")).toBe(false);
    expect(isConfidentCapabilityStatus("denied")).toBe(true);
    expect(isConfidentCapabilityStatus("available")).toBe(true);
    expect(isConfidentCapabilityStatus("preloaded")).toBe(true);
    expect(isConfidentCapabilityStatus("blocked")).toBe(true);
  });
});

describe("correctness gate", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
    vi.unstubAllEnvs();
    mockDetectClaudeVersion.mockReset();
  });

  for (const fixtureName of discoverFixtureNames()) {
    it(`passes gate for claude/${fixtureName} without confident mismatches`, async () => {
      const { actual, expected } = await runFixtureToGolden(fixtureName);
      const mismatches = findConfidentCapabilityMismatches(
        actual,
        expected,
        fixtureName,
      );

      expect(mismatches, JSON.stringify(mismatches, null, 2)).toEqual([]);
    });
  }

  it("reports fixture-verified vs documentation-only coverage counts", () => {
    const fixtures = discoverFixtureNames();
    expect(fixtures.length).toBeGreaterThan(0);

    const report = buildCoverageReport(fixtures);
    expect(report.runtimeObserved).toBe(0);
    expect(report.fixtureVerified).toBeGreaterThan(0);
    expect(
      report.fixtureVerified + report.documentationOnly + report.unverified,
    ).toBeGreaterThan(0);

    const formatted = formatCoverageReport(report);
    expect(formatted).toContain("fixture-verified");
    expect(formatted).toContain("documentation-only");
  });
});

describe("correctness gate fixture corpus", () => {
  it("includes expected.json for every discovered fixture", () => {
    for (const fixtureName of discoverFixtureNames()) {
      expect(
        fs.existsSync(path.join(FIXTURES_ROOT, fixtureName, "expected.json")),
      ).toBe(true);
    }
  });
});
