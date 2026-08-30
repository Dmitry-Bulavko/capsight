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
  gateCapability,
  gateWarning,
  isMatrixId,
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
import { selectFixtureAgent, fixtureHomeDir } from "../../../fixtures/fixture-runtime.js";

const CODEX_MATRIX_IDS = [
  "instruction.chain",
  "instruction.ancestors",
  "trust.project",
  "mcp.probe",
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
  const home = fixtureHomeDir();
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

  for (const contextSpec of contexts) {
    const agent = selectFixtureAgent(scanResult.snapshot.agents, contextSpec, projectRoot);
    const resolution = await resolve({
      snapshot: scanResult.snapshot,
      agentId: agent.id,
      context: buildExecutionContext(contextSpec.preset as "main-session"),
    });
    resolutions.push({ agentName: contextSpec.agentName, resolution });
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
  it("enforces supported entries", () => {
    expect(resolveEnforcement(MATRIX["instruction.chain"])).toEqual({
      enforcement: "enforced",
      unfounded: false,
      matrixRef: "instruction.chain",
    });
  });

  it("resolves unknown for missing or unknown-status entries", () => {
    expect(resolveEnforcement(MATRIX["mcp.probe"]).enforcement).toBe("unknown");
    expect(resolveEnforcement("agent.neverRegistered" as MatrixId).unfounded).toBe(true);
    expect(isMatrixId("agent.neverRegistered")).toBe(false);
  });
});

describe("codex gateWarning", () => {
  const untrustedWarning: Warning = {
    category: "trust",
    severity: "warning",
    message: "Project is untrusted; project .codex/ layers are not loaded (XT1).",
    evidence: [],
    enforcement: "enforced",
  };

  it("keeps enforcement when the matrix founds the warning", () => {
    const gated = gateWarning(untrustedWarning, MATRIX["trust.project"]);
    expect(gated.enforcement).toBe("enforced");
    expect(gated.matrixRef).toBe("trust.project");
  });

  it("downgrades when the matrix entry is unknown", () => {
    const gated = gateWarning(untrustedWarning, MATRIX["mcp.probe"]);
    expect(gated.enforcement).toBe("unknown");
  });
});

describe("codex gateCapability", () => {
  it("founds instruction chain on a supported entry", () => {
    expect(gateCapability(MATRIX["instruction.chain"])).toEqual({
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
