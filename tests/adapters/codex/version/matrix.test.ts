import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformVersion } from "../../../../src/core/model/index.js";
import {
  FACT,
  FACTS,
  factConfidence,
  isFactId,
} from "../../../../src/adapters/codex/version/facts.js";
import {
  compareSemver,
  gateCapability,
  gateWarning,
  isMatrixId,
  lookupFeature,
  resolveEnforcement,
  MATRIX,
  VERSION_MATRIX,
  type FeatureCompatibility,
  type MatrixId,
} from "../../../../src/adapters/codex/version/matrix.js";
import type { Warning } from "../../../../src/core/model/index.js";
import { buildExecutionContext } from "../../../../src/adapters/codex/resolution/context.js";
import { normalizeGoldenOutput } from "../../../fixtures/golden-normalize.js";
import { resolveFixtureScanPath } from "../../../fixtures/coverage-report.js";
import { selectFixtureAgent, resolveFixtureHomeDir } from "../../../fixtures/fixture-runtime.js";

const CODEX_MATRIX_IDS = [
  "instruction.chain",
  "instruction.fallback",
  "instruction.sizeCap",
  "agent.instructionBased",
  "agent.noSeparateAgentsArray",
  "settings.knownKeysOnly",
  "trust.project",
  "trust.unreadable",
  "instruction.ancestors",
  "discovery.skills",
  "discovery.skillFrontmatter",
  "discovery.mcpProject",
  "mcp.transport",
  "mcp.envRedact",
  "discovery.settings",
  "mcp.probe",
  "version.detect",
  "version.degraded",
  "version.scanBoundary",
  "discovery.repoRoot",
  "discovery.rootMarkers",
] as const;

const FIXTURES_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/codex",
);

const { mockDetectCodexVersion } = vi.hoisted(() => ({
  mockDetectCodexVersion: vi.fn<() => Promise<PlatformVersion>>(),
}));

vi.mock("../../../../src/adapters/codex/version/index.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../../src/adapters/codex/version/index.js")>();
  return {
    ...actual,
    detectCodexVersion: mockDetectCodexVersion,
    defaultCommandRunner: { run: vi.fn() },
  };
});

async function runCodexFixture(
  fixtureName: string,
): Promise<ReturnType<typeof normalizeGoldenOutput>> {
  const fixtureDir = path.join(FIXTURES_ROOT, fixtureName);
  const projectRoot = path.join(fixtureDir, "project");
  const version = (await fsPromises.readFile(path.join(fixtureDir, "version.txt"), "utf8")).trim();
  const env = JSON.parse(
    await fsPromises.readFile(path.join(fixtureDir, "env.json"), "utf8"),
  ) as Record<string, string>;
  const contexts = JSON.parse(
    await fsPromises.readFile(path.join(fixtureDir, "contexts.json"), "utf8"),
  ) as Array<{ agentName: string; agentSourcePath?: string; preset: string }>;

  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
  const home = resolveFixtureHomeDir(fixtureDir);
  vi.stubEnv("HOME", home);
  vi.stubEnv("USERPROFILE", home);
  vi.stubEnv("CODEX_HOME", path.join(home, ".codex"));

  mockDetectCodexVersion.mockResolvedValue({
    platform: "codex",
    version,
    raw: `codex-cli ${version}`,
    detectedAt: "1970-01-01T00:00:00.000Z",
  });

  const { scan } = await import("../../../../src/application/scan.js");
  const { resolve } = await import("../../../../src/application/resolve.js");

  const scanResult = await scan({
    projectPath: resolveFixtureScanPath(fixtureDir),
    platform: "codex",
  });
  const resolutions = [];

  if (scanResult.snapshot.agents.length > 0) {
    for (const contextSpec of contexts) {
      const agent = selectFixtureAgent(scanResult.snapshot.agents, contextSpec, projectRoot);
      const resolution = await resolve({
        snapshot: scanResult.snapshot,
        agentId: agent.id,
        context: buildExecutionContext(contextSpec.preset as "main-session"),
      });
      resolutions.push({ agentName: contextSpec.agentName, resolution });
    }
  }

  return normalizeGoldenOutput(scanResult.snapshot, resolutions, projectRoot);
}

describe("codex facts", () => {
  it("registers XR4 for ancestor instruction walk", () => {
    const xr4 = FACTS.find((fact) => fact.id === FACT.XR4);
    expect(xr4).toMatchObject({
      section: "9",
      confidence: "doc",
    });
    expect(xr4?.statement).toContain("Ancestor");
  });

  it("rejects unregistered ids", () => {
    expect(isFactId(FACT.XR4)).toBe(true);
    expect(isFactId("XR99")).toBe(false);
  });

  it("keeps XT2 at unknown trust storage level", () => {
    expect(factConfidence(FACT.XT2)).toBe("unknown");
  });
});

describe("codex VERSION_MATRIX", () => {
  it("contains an entry for each registered resolver rule", () => {
    expect(VERSION_MATRIX.map((entry) => entry.id)).toEqual([...CODEX_MATRIX_IDS]);
  });

  it("never names a fixture directory that lacks expected.json", () => {
    for (const entry of VERSION_MATRIX.filter((candidate) => candidate.fixture)) {
      const expectedPath = path.join(FIXTURES_ROOT, entry.fixture!, "expected.json");
      expect(fs.existsSync(expectedPath), `${entry.id} -> ${entry.fixture}`).toBe(true);
    }
  });

  it("makes every fixture entry state which facts it exercises entire (H1-28)", () => {
    for (const entry of VERSION_MATRIX) {
      if (!entry.fixture) {
        expect(entry.verifiedFacts, entry.id).toBeUndefined();
        continue;
      }
      expect(entry.verifiedFacts, `${entry.id} must declare verifiedFacts`).toBeDefined();
      for (const factId of entry.verifiedFacts ?? []) {
        expect(entry.factRefs.includes(factId)).toBe(true);
      }
      if ((entry.verifiedFacts ?? []).length > 0) {
        expect(entry.confidence, entry.id).not.toBe("doc");
      }
    }
  });

  it("keeps unknown-by-construction entries at doc confidence", () => {
    for (const entry of VERSION_MATRIX) {
      if (entry.status === "unknown") {
        expect(entry.confidence, entry.id).toBe("doc");
      }
    }
  });

  it("declares exactly one of fixture / pendingFixture / noFixturePossible", () => {
    for (const entry of VERSION_MATRIX) {
      const declared = [entry.fixture, entry.pendingFixture, entry.noFixturePossible].filter(
        (value) => value !== undefined,
      );
      expect(declared.length, entry.id).toBe(1);
    }
  });

  it("uses project-layers wording for trust, not sandbox claims", () => {
    const trust = VERSION_MATRIX.find((entry) => entry.id === "trust.project");
    expect(trust?.notes).toContain("project layers are not loaded");
    expect(trust?.notes?.toLowerCase()).not.toContain("sandbox");
  });

  it("keeps instruction.ancestors at doc confidence with no verified facts", () => {
    const ancestors = VERSION_MATRIX.find((entry) => entry.id === "instruction.ancestors");
    expect(ancestors?.status).toBe("supported");
    expect(ancestors?.confidence).toBe("doc");
    expect(ancestors?.verifiedFacts).toEqual([]);
  });
});

describe("codex resolveEnforcement", () => {
  const DETECTED = "0.130.0";

  it("enforces supported entries on a detected version", () => {
    expect(
      resolveEnforcement({ matrixId: MATRIX["instruction.chain"], version: DETECTED }),
    ).toEqual({
      enforcement: "enforced",
      unfounded: false,
      matrixRef: "instruction.chain",
    });
  });

  it("resolves unknown for missing, unknown-status, or undetected version entries", () => {
    expect(
      resolveEnforcement({ matrixId: MATRIX["mcp.probe"], version: DETECTED }).enforcement,
    ).toBe("unknown");
    expect(
      resolveEnforcement({
        matrixId: "agent.neverRegistered" as MatrixId,
        version: DETECTED,
      }).unfounded,
    ).toBe(true);
    expect(isMatrixId("agent.neverRegistered")).toBe(false);
    expect(
      resolveEnforcement({ matrixId: MATRIX["instruction.chain"], version: "unknown" })
        .enforcement,
    ).toBe("unknown");
  });

  it("downgrades only rules outside their declared version range", () => {
    withMatrixPatchSync(MATRIX["instruction.chain"], { minVersion: "99.0.0" }, () => {
      expect(
        resolveEnforcement({ matrixId: MATRIX["instruction.chain"], version: DETECTED })
          .enforcement,
      ).toBe("unknown");
      expect(
        resolveEnforcement({ matrixId: MATRIX["trust.project"], version: DETECTED }).enforcement,
      ).toBe("enforced");
    });
  });

  it("downgrades settings.knownKeysOnly above maxVersion while neighbors stay enforced", () => {
    withMatrixPatchSync(MATRIX["settings.knownKeysOnly"], { maxVersion: "0.130.0" }, () => {
      expect(
        resolveEnforcement({
          matrixId: MATRIX["settings.knownKeysOnly"],
          version: "0.131.0",
        }).enforcement,
      ).toBe("unknown");
      expect(
        resolveEnforcement({
          matrixId: MATRIX["instruction.chain"],
          version: "0.131.0",
        }).enforcement,
      ).toBe("enforced");
    });
  });
});

describe("codex lookupFeature", () => {
  const DETECTED = "0.130.0";

  it("marks entries unsupported below minVersion", () => {
    withMatrixPatchSync(MATRIX["instruction.chain"], { minVersion: "99.0.0" }, () => {
      expect(lookupFeature(MATRIX["instruction.chain"], DETECTED)?.status).toBe("unsupported");
      expect(lookupFeature(MATRIX["instruction.chain"], "99.0.0")?.status).toBe("supported");
    });
  });

  it("marks entries unsupported above maxVersion", () => {
    withMatrixPatchSync(MATRIX["settings.knownKeysOnly"], { maxVersion: "0.130.0" }, () => {
      expect(lookupFeature(MATRIX["settings.knownKeysOnly"], "0.131.0")?.status).toBe(
        "unsupported",
      );
      expect(lookupFeature(MATRIX["settings.knownKeysOnly"], "0.130.0")?.status).toBe("supported");
    });
  });

  it("returns unknown status when CLI version is unavailable", () => {
    expect(lookupFeature(MATRIX["instruction.chain"], "unknown")?.status).toBe("unknown");
  });
});

describe("codex compareSemver", () => {
  it("orders patch versions", () => {
    expect(compareSemver("0.130.0", "0.131.0")).toBeLessThan(0);
  });
});

describe("codex gateWarning", () => {
  const DETECTED = "0.130.0";
  const untrustedWarning: Warning = {
    category: "trust",
    severity: "warning",
    message: "Project is untrusted; project .codex/ layers are not loaded (XT1).",
    evidence: [],
    enforcement: "enforced",
  };

  it("keeps enforcement when the matrix founds the warning", () => {
    const gated = gateWarning(untrustedWarning, MATRIX["trust.project"], DETECTED);
    expect(gated.enforcement).toBe("enforced");
    expect(gated.matrixRef).toBe("trust.project");
  });

  it("downgrades when the matrix entry is unknown", () => {
    const gated = gateWarning(untrustedWarning, MATRIX["mcp.probe"], DETECTED);
    expect(gated.enforcement).toBe("unknown");
  });
});

describe("codex gateCapability", () => {
  const DETECTED = "0.130.0";

  it("founds instruction chain on a supported entry", () => {
    expect(gateCapability(MATRIX["instruction.chain"], DETECTED)).toEqual({
      enforcement: "enforced",
      unfounded: false,
      matrixRef: "instruction.chain",
    });
  });
});

describe("codex fixture deletion tests (H1-28)", () => {
  afterEach(() => {
    mockDetectCodexVersion.mockReset();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("instruction.chain: unfounding the matrix downgrades instruction capabilities", async () => {
    const baseline = await runCodexFixture("agents-precedence");
    expect(baseline.resolutions[0]!.capabilities[0]?.status).toBe("available");

    await withMatrixPatch(MATRIX["instruction.chain"], { status: "unknown" }, async () => {
      const withoutRule = await runCodexFixture("agents-precedence");
      expect(withoutRule.resolutions[0]!.capabilities[0]?.status).toBe("unknown");
    });
  });

  it("trust.project: unfounding the matrix downgrades the untrusted warning", async () => {
    const baseline = await runCodexFixture("trust-untrusted");
    const trustWarning = baseline.resolutions[0]!.warnings.find(
      (warning) => warning.matrixRef === MATRIX["trust.project"],
    );
    expect(trustWarning?.enforcement).toBe("enforced");
    expect(trustWarning?.message).toContain("project .codex/ layers are not loaded");

    await withMatrixPatch(MATRIX["trust.project"], { status: "unknown" }, async () => {
      const withoutRule = await runCodexFixture("trust-untrusted");
      const after = withoutRule.resolutions[0]!.warnings.find(
        (warning) => warning.matrixRef === MATRIX["trust.project"],
      );
      expect(after?.enforcement).toBe("unknown");
    });
  });

  it("instruction.fallback: unfounding the matrix skips fallback instructions", async () => {
    const baseline = await runCodexFixture("instruction-fallback");
    expect(baseline.discovery.instructions).toHaveLength(1);
    expect(baseline.discovery.instructions[0]).toMatchObject({ type: "fallback" });

    await withMatrixPatch(MATRIX["instruction.fallback"], { status: "unknown" }, async () => {
      const withoutRule = await runCodexFixture("instruction-fallback");
      expect(withoutRule.discovery.instructions).toEqual([]);
      expect(withoutRule.discovery.agents).toEqual([]);
    });
  });

  it("agent.instructionBased: unfounding the matrix marks synthetic main agent unknown", async () => {
    const baseline = await runCodexFixture("basic");
    expect(baseline.discovery.agents[0]).toMatchObject({ status: "active" });

    await withMatrixPatch(MATRIX["agent.instructionBased"], { status: "unknown" }, async () => {
      const withoutRule = await runCodexFixture("basic");
      expect(withoutRule.discovery.agents[0]).toMatchObject({ status: "unknown" });
    });
  });

  it("trust.unreadable: unfounding the matrix removes the unknown-trust warning", async () => {
    const baseline = await runCodexFixture("basic");
    expect(
      baseline.resolutions[0]!.warnings.some(
        (warning) => warning.matrixRef === MATRIX["trust.unreadable"],
      ),
    ).toBe(true);

    await withMatrixPatch(MATRIX["trust.unreadable"], { status: "unknown" }, async () => {
      const withoutRule = await runCodexFixture("basic");
      expect(
        withoutRule.resolutions[0]!.warnings.some(
          (warning) => warning.matrixRef === MATRIX["trust.unreadable"],
        ),
      ).toBe(false);
    });
  });

  it("settings.knownKeysOnly: unfounding the matrix strips settings unknownFields", async () => {
    const baseline = await runCodexFixture("basic");
    const settingsLayer = baseline.discovery.settings[0] as {
      unknownFields?: Record<string, string>;
    };
    expect(settingsLayer?.unknownFields).toEqual({
      experimental_feature_enabled: "boolean",
    });

    await withMatrixPatch(MATRIX["settings.knownKeysOnly"], { status: "unknown" }, async () => {
      const withoutRule = await runCodexFixture("basic");
      const strippedLayer = withoutRule.discovery.settings[0] as {
        unknownFields?: Record<string, string>;
      };
      expect(strippedLayer?.unknownFields).toBeUndefined();
    });
  });

  it("settings.knownKeysOnly: version above maxVersion strips unknownFields only", async () => {
    const baseline = await runCodexFixture("version-drift");
    const settingsLayer = baseline.discovery.settings[0] as {
      unknownFields?: Record<string, string>;
    };
    expect(settingsLayer?.unknownFields).toBeUndefined();

    expect(baseline.resolutions[0]!.capabilities[0]).toMatchObject({
      capabilityId: "instruction:AGENTS.md",
      status: "available",
      enforcement: "enforced",
    });

    await withMatrixPatch(MATRIX["settings.knownKeysOnly"], { maxVersion: undefined }, async () => {
      const withoutBound = await runCodexFixture("version-drift");
      const restoredLayer = withoutBound.discovery.settings[0] as {
        unknownFields?: Record<string, string>;
      };
      expect(restoredLayer?.unknownFields).toEqual({
        experimental_feature_enabled: "boolean",
      });
    });
  });
});

async function withMatrixPatch(
  id: MatrixId,
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

function withMatrixPatchSync(
  id: MatrixId,
  patch: Partial<FeatureCompatibility>,
  body: () => void,
): void {
  const entry = VERSION_MATRIX.find((candidate) => candidate.id === id)!;
  const original = { ...entry };
  Object.assign(entry, patch);
  try {
    body();
  } finally {
    for (const key of Object.keys(entry) as Array<keyof FeatureCompatibility>) {
      delete (entry as unknown as Record<string, unknown>)[key];
    }
    Object.assign(entry, original);
  }
}
