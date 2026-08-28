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
  findUndeclaredFixtureDirectories,
  formatCoverageReport,
  formatPendingFixtures,
  inspectFixtureCorpus,
  isConfidentCapabilityStatus,
  pendingFixtureNames,
  FIXTURES_ROOT,
  SPEC_FIXTURE_NAMES,
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
        kind: "capability-mismatch",
        fixtureName: "sample",
        agentName: "agent",
        capabilityId: "Read",
        actualStatus: "available",
        expectedStatus: "denied",
        actualEnforcement: "enforced",
        expectedEnforcement: "enforced",
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
        kind: "capability-mismatch",
        fixtureName: "sample",
        agentName: "agent",
        capabilityId: "Grep",
        actualStatus: "available",
        expectedStatus: undefined,
        actualEnforcement: "enforced",
        expectedEnforcement: undefined,
      },
    ]);
  });

  it("fails when confident enforcement differs from golden expectation", () => {
    const expected = emptyGolden("agent");
    expected.resolutions[0]!.capabilities = [
      {
        capabilityId: "Read",
        kind: "tool",
        status: "available",
        enforcement: "advisory",
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
        kind: "capability-mismatch",
        fixtureName: "sample",
        agentName: "agent",
        capabilityId: "Read",
        actualStatus: "available",
        expectedStatus: "available",
        actualEnforcement: "enforced",
        expectedEnforcement: "advisory",
      },
    ]);
  });

  it("treats unknown actual enforcement as non-blocking", () => {
    const expected = emptyGolden("agent");
    expected.resolutions[0]!.capabilities = [
      {
        capabilityId: "Read",
        kind: "tool",
        status: "available",
        enforcement: "advisory",
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
        enforcement: "unknown",
        sources: [],
        reasons: [],
      },
    ];

    expect(
      findConfidentCapabilityMismatches(actual, expected, "sample"),
    ).toEqual([]);
  });

  it("fails when an expected resolution has no matching actual resolution", () => {
    const expected = emptyGolden("agent");
    const actual = emptyGolden("agent");
    actual.resolutions = [];

    const mismatches = findConfidentCapabilityMismatches(
      actual,
      expected,
      "sample",
    );

    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatchObject({
      kind: "missing-resolution",
      fixtureName: "sample",
      agentName: "agent",
    });
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
  /**
   * Fixtures from SPEC §11.1 that are not yet authored (H1-09..H1-11).
   * Shrink this list as fixtures land; the test below fails until it matches
   * reality, so the corpus cannot silently stay incomplete.
   */
  const EXPECTED_PENDING_FIXTURES = [
    "add-dir",
    "collision-nested",
    "collision-same-dir",
    "depth-limit",
    "environment",
    "instructions",
    "invalid-agents",
    "managed-simulation",
    "nested-project",
    "plugin-agents",
    "settings-permissions",
    "skill-allowed-tools",
    "version-drift",
  ];

  it("declares exactly the 20 SPEC §11.1 fixture names", () => {
    expect(SPEC_FIXTURE_NAMES).toHaveLength(20);
    expect([...SPEC_FIXTURE_NAMES]).toEqual([...SPEC_FIXTURE_NAMES].sort());
  });

  it("has no fixture directory outside the declared §11.1 corpus", () => {
    const undeclared = findUndeclaredFixtureDirectories(FIXTURES_ROOT);
    expect(undeclared, undeclared.join(", ")).toEqual([]);
  });

  it("classifies every declared fixture and names its missing contract files", () => {
    const corpus = inspectFixtureCorpus(FIXTURES_ROOT);
    expect(corpus.map((status) => status.name)).toEqual([...SPEC_FIXTURE_NAMES]);

    for (const status of corpus) {
      expect(status.completeness, status.name).not.toBe("missing");
      if (status.completeness === "complete") {
        expect(status.missingEntries, status.name).toEqual([]);
      } else {
        expect(status.missingEntries.length, status.name).toBeGreaterThan(0);
      }
    }
  });

  it("matches the registered pending-fixture list", () => {
    const pending = pendingFixtureNames(FIXTURES_ROOT);
    expect(
      pending,
      formatPendingFixtures(inspectFixtureCorpus(FIXTURES_ROOT)),
    ).toEqual(EXPECTED_PENDING_FIXTURES);
  });

  it("runs the gate over every complete fixture and nothing else", () => {
    const complete = discoverFixtureNames(FIXTURES_ROOT);
    const pending = pendingFixtureNames(FIXTURES_ROOT);

    expect([...complete, ...pending].sort()).toEqual([...SPEC_FIXTURE_NAMES]);
    expect(complete.length).toBe(SPEC_FIXTURE_NAMES.length - pending.length);
  });

  it("prints the pending fixtures with a count", () => {
    const formatted = formatPendingFixtures(inspectFixtureCorpus(FIXTURES_ROOT));
    expect(formatted).toContain(
      "pending fixtures (SPEC §11.1): " + EXPECTED_PENDING_FIXTURES.length + " of 20",
    );
    for (const name of EXPECTED_PENDING_FIXTURES) {
      expect(formatted).toContain(name);
    }
  });
});
