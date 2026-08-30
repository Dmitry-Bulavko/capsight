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
} from "../../../../src/adapters/cursor/version/facts.js";
import {
  gateCollision,
  gateDiscovery,
  gateWarning,
  isMatrixId,
  resolveEnforcement,
  MATRIX,
  VERSION_MATRIX,
  type FeatureCompatibility,
  type MatrixId,
} from "../../../../src/adapters/cursor/version/matrix.js";
import type { Warning } from "../../../../src/core/model/index.js";
import { buildExecutionContext } from "../../../../src/adapters/cursor/resolution/context.js";
import { normalizeGoldenOutput } from "../../../fixtures/golden-normalize.js";
import { selectFixtureAgent } from "../../../fixtures/fixture-runtime.js";

const CURSOR_MATRIX_IDS = [
  "agent.toolPool",
  "trust.project",
  "collision.sameDir",
  "rules.fileExtension",
  "agent.invalid",
] as const;

const FIXTURES_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/cursor",
);

const { mockDetectCursorVersion } = vi.hoisted(() => ({
  mockDetectCursorVersion: vi.fn<() => Promise<PlatformVersion>>(),
}));

vi.mock("../../../../src/adapters/cursor/version/index.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../../src/adapters/cursor/version/index.js")>();
  return {
    ...actual,
    detectCursorVersion: mockDetectCursorVersion,
    defaultCommandRunner: { run: vi.fn() },
  };
});

async function runCursorFixture(
  fixtureName: string,
): Promise<ReturnType<typeof normalizeGoldenOutput>> {
  const fixtureDir = path.join(FIXTURES_ROOT, fixtureName);
  const projectRoot = path.join(fixtureDir, "project");
  const version = (await fsPromises.readFile(path.join(fixtureDir, "version.txt"), "utf8")).trim();
  const contexts = JSON.parse(
    await fsPromises.readFile(path.join(fixtureDir, "contexts.json"), "utf8"),
  ) as Array<{ agentName: string; agentSourcePath?: string; preset: string }>;

  mockDetectCursorVersion.mockResolvedValue({
    platform: "cursor",
    version,
    raw: version,
    detectedAt: "1970-01-01T00:00:00.000Z",
  });

  const { scan } = await import("../../../../src/application/scan.js");
  const { resolve } = await import("../../../../src/application/resolve.js");

  const scanResult = await scan({ projectPath: projectRoot, platform: "cursor" });
  const resolutions = [];

  for (const contextSpec of contexts) {
    const agent = selectFixtureAgent(scanResult.snapshot.agents, contextSpec, projectRoot);
    const resolution = await resolve({
      snapshot: scanResult.snapshot,
      agentId: agent.id,
      context: buildExecutionContext(contextSpec.preset as "background-subagent"),
    });
    resolutions.push({ agentName: contextSpec.agentName, resolution });
  }

  return normalizeGoldenOutput(scanResult.snapshot, resolutions, projectRoot);
}

describe("cursor facts", () => {
  it("registers CR4 for plain .md rules ignored", () => {
    const cr4 = FACTS.find((fact) => fact.id === FACT.CR4);
    expect(cr4).toMatchObject({
      section: "6",
      confidence: "doc",
    });
    expect(cr4?.statement).toContain(".mdc");
  });

  it("rejects unregistered ids", () => {
    expect(isFactId(FACT.CR4)).toBe(true);
    expect(isFactId("CR99")).toBe(false);
  });

  it("keeps CT1 at unknown trust level", () => {
    expect(factConfidence(FACT.CT1)).toBe("unknown");
  });
});

describe("cursor VERSION_MATRIX", () => {
  it("contains an entry for each registered resolver rule", () => {
    expect(VERSION_MATRIX.map((entry) => entry.id)).toEqual([...CURSOR_MATRIX_IDS]);
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

  it("leaves CT1 trust unknown with reason intact", () => {
    const trust = VERSION_MATRIX.find((entry) => entry.id === "trust.project");
    expect(trust?.status).toBe("unknown");
    expect(trust?.factRefs).toEqual([FACT.CT1]);
    expect(trust?.noFixturePossible).toContain("CT1");
  });
});

describe("cursor resolveEnforcement", () => {
  it("enforces supported entries", () => {
    expect(resolveEnforcement(MATRIX["rules.fileExtension"])).toEqual({
      enforcement: "enforced",
      unfounded: false,
      matrixRef: "rules.fileExtension",
    });
  });

  it("resolves unknown for missing or unknown-status entries", () => {
    expect(resolveEnforcement(MATRIX["trust.project"]).enforcement).toBe("unknown");
    expect(resolveEnforcement("agent.neverRegistered" as MatrixId).unfounded).toBe(true);
    expect(isMatrixId("agent.neverRegistered")).toBe(false);
  });
});

describe("cursor gateWarning", () => {
  const ignoredWarning: Warning = {
    category: "unsupported",
    severity: "warning",
    message: "Plain .md ignored.",
    evidence: [],
    enforcement: "enforced",
  };

  it("keeps enforcement when the matrix founds the warning", () => {
    const gated = gateWarning(ignoredWarning, MATRIX["rules.fileExtension"]);
    expect(gated.enforcement).toBe("enforced");
    expect(gated.matrixRef).toBe("rules.fileExtension");
  });

  it("downgrades when the matrix entry is unknown", () => {
    const gated = gateWarning(ignoredWarning, MATRIX["trust.project"]);
    expect(gated.enforcement).toBe("unknown");
  });
});

describe("cursor gateCollision and gateDiscovery", () => {
  it("founds same-directory collision on a supported entry", () => {
    expect(gateCollision(MATRIX["collision.sameDir"])).toEqual({
      enforcement: "enforced",
      unfounded: false,
      matrixRef: "collision.sameDir",
    });
  });

  it("founds invalid-agent discovery on a supported entry", () => {
    expect(gateDiscovery(MATRIX["agent.invalid"])).toEqual({
      enforcement: "enforced",
      unfounded: false,
    });
  });
});

describe("cursor fixture deletion tests (H1-28)", () => {
  afterEach(() => {
    mockDetectCursorVersion.mockReset();
    vi.restoreAllMocks();
  });

  it("rules.fileExtension: removing ignored-rule detection drops the CR4 warning", async () => {
    const instructions = await import("../../../../src/adapters/cursor/discovery/instructions.js");
    const baseline = await runCursorFixture("ignored-rules");
    const cr4Warning = baseline.resolutions[0]!.warnings.find(
      (warning) => warning.matrixRef === MATRIX["rules.fileExtension"],
    );
    expect(cr4Warning?.enforcement).toBe("enforced");

    vi.spyOn(instructions, "discoverIgnoredRuleFiles").mockResolvedValue([]);
    const withoutRule = await runCursorFixture("ignored-rules");
    const after = withoutRule.resolutions[0]!.warnings.find(
      (warning) => warning.matrixRef === MATRIX["rules.fileExtension"],
    );
    expect(after).toBeUndefined();
  });

  it("collision.sameDir: unfounded matrix clears ambiguous status", async () => {
    const baseline = await runCursorFixture("collision-same-dir");
    expect(
      baseline.discovery.agents.filter(
        (agent) => (agent as { status?: string }).status === "ambiguous",
      ).length,
    ).toBe(2);

    await withMatrixPatch(MATRIX["collision.sameDir"], { status: "unknown" }, async () => {
      const withoutRule = await runCursorFixture("collision-same-dir");
      expect(
        withoutRule.discovery.agents.filter(
          (agent) => (agent as { status?: string }).status === "ambiguous",
        ).length,
      ).toBe(0);
    });
  });

  it("agent.invalid: removing validation drops invalid agents from discovery", async () => {
    const baseline = await runCursorFixture("invalid-agents");
    expect(
      baseline.discovery.agents.filter(
        (agent) => (agent as { status?: string }).status === "invalid",
      ).length,
    ).toBe(2);

    await withMatrixPatch(MATRIX["agent.invalid"], { status: "unknown" }, async () => {
      const withoutRule = await runCursorFixture("invalid-agents");
      expect(
        withoutRule.discovery.agents.filter(
          (agent) => (agent as { status?: string }).status === "invalid",
        ).length,
      ).toBe(0);
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
