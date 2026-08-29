import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  EffectiveConfiguration,
  PlatformVersion,
} from "../src/core/model/index.js";
import type { ManagedSimulationResult } from "../src/application/simulate.js";
import { buildExecutionContext } from "../src/adapters/claude/resolution/context.js";
import type { ContextPreset } from "../src/core/model/index.js";
import type { PermissionMode } from "../src/adapters/claude/model/index.js";
import { FACTS } from "../src/adapters/claude/version/facts.js";
import { VERSION_MATRIX } from "../src/adapters/claude/version/matrix.js";
import {
  buildCoverageReport,
  classifyFactCoverage,
  discoverFixtureNames,
  findConfidentCapabilityMismatches,
  findUndeclaredFixtureDirectories,
  formatCoverageReport,
  formatPendingFixtures,
  inspectFixtureCorpus,
  isConfidentCapabilityStatus,
  pendingFixtureNames,
  resolveFixtureAddDirs,
  resolveFixtureManagedBundle,
  resolveFixtureScanPath,
  FIXTURES_ROOT,
  SPEC_FIXTURE_NAMES,
} from "./fixtures/coverage-report.js";
import {
  normalizeGoldenOutput,
  type NormalizedGoldenOutput,
} from "./fixtures/golden-normalize.js";
import {
  cleanupFixtureHome,
  fixtureHomeDir,
  restoreProcessEnv,
  selectFixtureAgent,
} from "./fixtures/fixture-runtime.js";

const { mockDetectClaudeVersion } = vi.hoisted(() => ({
  mockDetectClaudeVersion: vi.fn<() => Promise<PlatformVersion>>(),
}));

vi.mock("../src/adapters/claude/version/index.js", () => ({
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

function applyFixtureEnv(env: Record<string, string>): void {
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
  const home = fixtureHomeDir();
  vi.stubEnv("HOME", home);
  vi.stubEnv("USERPROFILE", home);
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

  const addDirs = resolveFixtureAddDirs(fixtureDir);
  const scanResult = await scan({
    projectPath: resolveFixtureScanPath(fixtureDir),
    ...(addDirs.length > 0 ? { addDirs } : {}),
  });
  const resolutions: Array<{ agentName: string; resolution: EffectiveConfiguration }> =
    [];

  for (const contextSpec of contract.contexts) {
    const agent = selectFixtureAgent(
      scanResult.snapshot.agents,
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
      snapshot: scanResult.snapshot,
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
      "../src/application/simulate.js"
    );
    simulation = await simulateManagedOverlay({
      managedBundlePath,
      snapshot: scanResult.snapshot,
    });
  }

  const actual = normalizeGoldenOutput(
    scanResult.snapshot,
    resolutions,
    projectRoot,
    simulation,
  );
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
    const enforced = { enforcement: "enforced" } as const;
    expect(isConfidentCapabilityStatus({ status: "unknown", ...enforced })).toBe(false);
    expect(isConfidentCapabilityStatus({ status: "denied", ...enforced })).toBe(true);
    expect(isConfidentCapabilityStatus({ status: "available", ...enforced })).toBe(true);
    expect(isConfidentCapabilityStatus({ status: "preloaded", ...enforced })).toBe(true);
    expect(isConfidentCapabilityStatus({ status: "blocked", ...enforced })).toBe(true);
  });

  it("does not treat a claim the product disowns as confident (H1-17)", () => {
    expect(
      isConfidentCapabilityStatus({ status: "denied", enforcement: "unknown" }),
    ).toBe(false);
    expect(
      isConfidentCapabilityStatus({ status: "denied", enforcement: "advisory" }),
    ).toBe(true);
  });
});

describe("correctness gate", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    vi.unstubAllEnvs();
    restoreProcessEnv(envSnapshot);
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

  it("counts coverage over the fixed §3 fact corpus, not the registered subset", () => {
    const fixtures = discoverFixtureNames();
    expect(fixtures.length).toBeGreaterThan(0);

    const report = buildCoverageReport(fixtures);

    // §11.4: the denominator is the whole §3 registry and cannot shrink.
    expect(report.total).toBe(FACTS.length);
    expect(
      report.runtimeObserved +
        report.fixtureVerified +
        report.documentationOnly +
        report.unverified,
    ).toBe(FACTS.length);

    // No runtime probing exists while the S0 fallback holds (§9.5).
    expect(report.runtimeObserved).toBe(0);

    // A fact no matrix entry references is unverified — recomputed here from
    // the registries so the report cannot quietly reclassify it.
    const referenced = new Set<string>(
      VERSION_MATRIX.flatMap((entry) => [...entry.factRefs]),
    );
    const unreferenced = FACTS.filter((fact) => !referenced.has(fact.id));
    expect(unreferenced.length).toBeGreaterThan(0);
    expect(report.unverified).toBe(unreferenced.length);
    for (const fact of unreferenced) {
      expect(classifyFactCoverage(fact.id, new Set(fixtures))).toBe("unverified");
    }

    // Every fact a matrix entry references is at least documentation-only.
    expect(report.fixtureVerified + report.documentationOnly).toBe(
      FACTS.length - unreferenced.length,
    );

    const formatted = formatCoverageReport(report);
    expect(formatted).toContain("SPEC §3 facts       : " + FACTS.length);
    expect(formatted).toContain("fixture-verified    : " + report.fixtureVerified);
    expect(formatted).toContain("unverified          : " + report.unverified);
  });

  it("counts fixture-verified only when a matrix entry raised its own confidence", () => {
    const fixtures = ["tools-filters"];
    const facts = [{ id: FACTS[0]!.id }] as const;

    const docEntryWithFixture = [
      {
        id: "probe",
        feature: "probe",
        factRefs: [FACTS[0]!.id],
        status: "supported",
        confidence: "doc",
        fixture: "tools-filters",
      },
    ] as const;

    // Fixture directory exists, but the entry never claimed fixture evidence.
    expect(
      buildCoverageReport(fixtures, { facts, matrix: docEntryWithFixture }),
    ).toMatchObject({ fixtureVerified: 0, documentationOnly: 1 });

    // Entry claims fixture evidence, but the named fixture is not available.
    expect(
      buildCoverageReport([], {
        facts,
        matrix: [{ ...docEntryWithFixture[0], confidence: "fixture" }],
      }),
    ).toMatchObject({ fixtureVerified: 0, documentationOnly: 1 });

    // Both conditions hold.
    expect(
      buildCoverageReport(fixtures, {
        facts,
        matrix: [{ ...docEntryWithFixture[0], confidence: "fixture" }],
      }),
    ).toMatchObject({ fixtureVerified: 1, documentationOnly: 0 });

    // `runtime-observed` stays structurally reachable, and is 0 in the real
    // matrix only because no entry carries runtime evidence yet (§9.5).
    expect(
      buildCoverageReport(fixtures, {
        facts,
        matrix: [{ ...docEntryWithFixture[0], confidence: "runtime-observed" }],
      }),
    ).toMatchObject({ runtimeObserved: 1, fixtureVerified: 0 });
  });

  it("keeps the coverage report out of every route and UI component", () => {
    // §13 invariant 13: the suite metric is a property of the test suite, not
    // of the scanned project, so no shipped source may import or render it.
    const srcRoot = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "src",
    );

    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry.name)) {
          continue;
        }
        const source = fs.readFileSync(full, "utf8");
        if (
          /coverage-report|buildCoverageReport|formatCoverageReport|fixture-verified|documentation-only/.test(
            source,
          )
        ) {
          offenders.push(path.relative(srcRoot, full));
        }
      }
    };
    walk(srcRoot);

    expect(offenders, offenders.join(", ")).toEqual([]);
  });
});

describe("correctness gate fixture corpus", () => {
  /**
   * Fixtures from SPEC §11.1 that are not yet authored. `plugin-agents`
   * (F9, A6, A8) stays pending because discovery has no plugin agent source
   * at all: nothing sets `isPluginAgent`, so a plugin fixture would assert
   * behaviour the product does not have yet.
   * Shrink this list as fixtures land; the test below fails until it matches
   * reality, so the corpus cannot silently stay incomplete.
   */
  const EXPECTED_PENDING_FIXTURES = ["plugin-agents"];

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
