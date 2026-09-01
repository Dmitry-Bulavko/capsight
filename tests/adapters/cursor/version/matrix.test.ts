import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withMatrixPatch, withMatrixPatchSync } from "../../../helpers/matrix-patch.js";
import type { PlatformVersion } from "../../../../src/core/model/index.js";
import {
  FACT,
  FACTS,
  factConfidence,
  isFactId,
} from "../../../../src/adapters/cursor/version/facts.js";
import {
  compareSemver,
  gateCollision,
  gateDiscovery,
  gateWarning,
  isMatrixId,
  lookupFeature,
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
  "discovery.mcpProject",
  "mcp.envRedact",
  "discovery.commands",
  "discovery.ruleFrontmatter",
  "mcp.probe",
  "version.degraded",
  "discovery.agents",
  "discovery.skills",
  "discovery.projectBoundary",
  "discovery.scopedMetadata",
  "discovery.nestedAgentsMd",
  "rules.applicationMode",
  "discovery.instructionTypes",
  "settings.userJson",
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
  const DETECTED = "3.16.17";

  it("enforces supported entries on a detected version", () => {
    expect(
      resolveEnforcement({ matrixId: MATRIX["rules.fileExtension"], version: DETECTED }),
    ).toEqual({
      enforcement: "enforced",
      unfounded: false,
      matrixRef: "rules.fileExtension",
    });
  });

  it("resolves unknown for missing, unknown-status, or undetected version entries", () => {
    expect(
      resolveEnforcement({ matrixId: MATRIX["trust.project"], version: DETECTED }).enforcement,
    ).toBe("unknown");
    expect(
      resolveEnforcement({
        matrixId: "agent.neverRegistered" as MatrixId,
        version: DETECTED,
      }).unfounded,
    ).toBe(true);
    expect(isMatrixId("agent.neverRegistered")).toBe(false);
    expect(
      resolveEnforcement({ matrixId: MATRIX["rules.fileExtension"], version: "unknown" })
        .enforcement,
    ).toBe("unknown");
  });

  it("downgrades only rules outside their declared version range", () => {
    withMatrixPatchSync(VERSION_MATRIX,
      MATRIX["rules.fileExtension"],
      { minVersion: "99.0.0", maxVersion: undefined },
      () => {
      expect(
        resolveEnforcement({ matrixId: MATRIX["rules.fileExtension"], version: DETECTED })
          .enforcement,
      ).toBe("unknown");
      expect(
        resolveEnforcement({ matrixId: MATRIX["collision.sameDir"], version: DETECTED })
          .enforcement,
      ).toBe("enforced");
    },
    );
  });
});

describe("cursor lookupFeature", () => {
  const DETECTED = "3.16.17";

  it("marks entries unsupported below minVersion", () => {
    withMatrixPatchSync(VERSION_MATRIX,
      MATRIX["rules.fileExtension"],
      { minVersion: "99.0.0", maxVersion: undefined },
      () => {
      expect(lookupFeature(MATRIX["rules.fileExtension"], DETECTED)?.status).toBe("unsupported");
      expect(lookupFeature(MATRIX["rules.fileExtension"], "99.0.0")?.status).toBe("supported");
    },
    );
  });

  it("marks entries unsupported above maxVersion", () => {
    withMatrixPatchSync(VERSION_MATRIX,MATRIX["rules.fileExtension"], { maxVersion: "3.0.0" }, () => {
      expect(lookupFeature(MATRIX["rules.fileExtension"], DETECTED)?.status).toBe("unsupported");
      expect(lookupFeature(MATRIX["rules.fileExtension"], "3.0.0")?.status).toBe("supported");
    });
  });

  it("returns unknown status when CLI version is unavailable", () => {
    expect(lookupFeature(MATRIX["rules.fileExtension"], "unknown")?.status).toBe("unknown");
  });
});

describe("cursor compareSemver", () => {
  it("orders patch versions", () => {
    expect(compareSemver("3.16.17", "3.16.20")).toBeLessThan(0);
    expect(compareSemver("3.16.20", "3.16.17")).toBeGreaterThan(0);
  });
});

describe("cursor gateWarning", () => {
  const DETECTED = "3.16.17";
  const ignoredWarning: Warning = {
    category: "unsupported",
    severity: "warning",
    message: "Plain .md ignored.",
    evidence: [],
    enforcement: "enforced",
  };

  it("keeps enforcement when the matrix founds the warning", () => {
    const gated = gateWarning(ignoredWarning, MATRIX["rules.fileExtension"], DETECTED);
    expect(gated.enforcement).toBe("enforced");
    expect(gated.matrixRef).toBe("rules.fileExtension");
  });

  it("downgrades when the matrix entry is unknown", () => {
    const gated = gateWarning(ignoredWarning, MATRIX["trust.project"], DETECTED);
    expect(gated.enforcement).toBe("unknown");
  });

  it("downgrades when the detected version is outside the entry range", () => {
    withMatrixPatchSync(VERSION_MATRIX,
      MATRIX["rules.fileExtension"],
      { minVersion: "99.0.0", maxVersion: undefined },
      () => {
      const gated = gateWarning(ignoredWarning, MATRIX["rules.fileExtension"], DETECTED);
      expect(gated.enforcement).toBe("unknown");
    },
    );
  });
});

describe("cursor gateCollision and gateDiscovery", () => {
  const DETECTED = "3.16.17";

  it("founds same-directory collision on a supported entry", () => {
    expect(gateCollision(MATRIX["collision.sameDir"], DETECTED)).toEqual({
      enforcement: "enforced",
      unfounded: false,
      matrixRef: "collision.sameDir",
    });
  });

  it("founds invalid-agent discovery on a supported entry", () => {
    expect(gateDiscovery(MATRIX["agent.invalid"], DETECTED)).toEqual({
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

  it("rules.fileExtension: version above maxVersion downgrades only the CR4 warning", async () => {
    const baseline = await runCursorFixture("version-drift");
    const cr4Warning = baseline.resolutions[0]!.warnings.find(
      (warning) => warning.matrixRef === MATRIX["rules.fileExtension"],
    );
    expect(cr4Warning?.enforcement).toBe("unknown");

    const scopedRule = baseline.discovery.instructions.find(
      (instruction) =>
        (instruction as { path?: string }).path === ".cursor/rules/scoped.mdc",
    ) as { description?: string; globs?: string[] } | undefined;
    expect(scopedRule?.description).toBe("Scoped TypeScript rule");
    expect(scopedRule?.globs).toEqual(["**/*.ts"]);

    await withMatrixPatch(VERSION_MATRIX,MATRIX["rules.fileExtension"], { maxVersion: undefined }, async () => {
      const withoutBound = await runCursorFixture("version-drift");
      const after = withoutBound.resolutions[0]!.warnings.find(
        (warning) => warning.matrixRef === MATRIX["rules.fileExtension"],
      );
      expect(after?.enforcement).toBe("enforced");
    });
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

    await withMatrixPatch(VERSION_MATRIX,MATRIX["collision.sameDir"], { status: "unknown" }, async () => {
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

    await withMatrixPatch(VERSION_MATRIX,MATRIX["agent.invalid"], { status: "unknown" }, async () => {
      const withoutRule = await runCursorFixture("invalid-agents");
      expect(
        withoutRule.discovery.agents.filter(
          (agent) => (agent as { status?: string }).status === "invalid",
        ).length,
      ).toBe(0);
    });
  });

  it("discovery.mcpProject: skipping project MCP discovery empties mcpServers", async () => {
    const baseline = await runCursorFixture("basic");
    expect(baseline.discovery.mcpServers).toHaveLength(1);

    const mcp = await import("../../../../src/adapters/cursor/discovery/mcp.js");
    vi.spyOn(mcp, "discoverMcpServers").mockResolvedValue([]);
    const withoutRule = await runCursorFixture("basic");
    expect(withoutRule.discovery.mcpServers).toHaveLength(0);
  });

  it("mcp.envRedact: omitting env key extraction drops envKeys from discovery", async () => {
    const baseline = await runCursorFixture("basic");
    expect(
      (baseline.discovery.mcpServers[0] as { envKeys?: string[] }).envKeys,
    ).toEqual(["GITHUB_TOKEN"]);

    const redact = await import("../../../../src/adapters/cursor/discovery/redact.js");
    vi.spyOn(redact, "extractEnvKeys").mockReturnValue([]);
    const withoutRule = await runCursorFixture("basic");
    expect(
      (withoutRule.discovery.mcpServers[0] as { envKeys?: string[] }).envKeys,
    ).toBeUndefined();
  });

  it("discovery.commands: omitting command discovery drops command entries", async () => {
    const baseline = await runCursorFixture("basic");
    expect(
      baseline.discovery.skills.filter(
        (skill) => (skill as { kind?: string }).kind === "command",
      ).length,
    ).toBe(1);

    const skills = await import("../../../../src/adapters/cursor/discovery/skills.js");
    const discoverSkills = skills.discoverSkills;
    vi.spyOn(skills, "discoverSkills").mockImplementation(async (scopes, projectPath) => {
      const discovered = await discoverSkills(scopes, projectPath);
      return discovered.filter((skill) => skill.kind !== "command");
    });
    const withoutRule = await runCursorFixture("basic");
    expect(
      withoutRule.discovery.skills.filter(
        (skill) => (skill as { kind?: string }).kind === "command",
      ).length,
    ).toBe(0);
  });

  it("discovery.agents: skipping agents discovery empties agents", async () => {
    const fixtureDir = path.join(FIXTURES_ROOT, "basic");
    const projectRoot = path.join(fixtureDir, "project");
    const version = (await fsPromises.readFile(path.join(fixtureDir, "version.txt"), "utf8")).trim();

    mockDetectCursorVersion.mockResolvedValue({
      platform: "cursor",
      version,
      raw: version,
      detectedAt: "1970-01-01T00:00:00.000Z",
    });

    const { scan } = await import("../../../../src/application/scan.js");
    const baseline = await scan({ projectPath: projectRoot, platform: "cursor" });
    expect(baseline.snapshot.agents).toHaveLength(1);

    const agents = await import("../../../../src/adapters/cursor/discovery/agents.js");
    vi.spyOn(agents, "discoverAgents").mockResolvedValue({ agents: [], invalidCount: 0 });
    const withoutRule = await scan({ projectPath: projectRoot, platform: "cursor" });
    expect(withoutRule.snapshot.agents).toHaveLength(0);
  });

  it("discovery.skills: skipping skills-directory discovery drops skill entries", async () => {
    const baseline = await runCursorFixture("basic");
    expect(
      baseline.discovery.skills.filter(
        (skill) => (skill as { kind?: string }).kind === "skill",
      ).length,
    ).toBe(1);

    const skills = await import("../../../../src/adapters/cursor/discovery/skills.js");
    const discoverSkills = skills.discoverSkills;
    vi.spyOn(skills, "discoverSkills").mockImplementation(async (scopes, projectPath) => {
      const discovered = await discoverSkills(scopes, projectPath);
      return discovered.filter((skill) => skill.kind !== "skill");
    });
    const withoutRule = await runCursorFixture("basic");
    expect(
      withoutRule.discovery.skills.filter(
        (skill) => (skill as { kind?: string }).kind === "skill",
      ).length,
    ).toBe(0);
  });

  it("discovery.instructionTypes: skipping instruction discovery drops typed instructions", async () => {
    const baseline = await runCursorFixture("basic");
    expect(
      baseline.discovery.instructions.some(
        (instruction) => (instruction as { type?: string }).type === "rule",
      ),
    ).toBe(true);
    expect(
      baseline.discovery.instructions.some(
        (instruction) => (instruction as { type?: string }).type === "AGENTS.md",
      ),
    ).toBe(true);

    const instructions = await import(
      "../../../../src/adapters/cursor/discovery/instructions.js"
    );
    vi.spyOn(instructions, "discoverInstructions").mockResolvedValue([]);
    const withoutRule = await runCursorFixture("basic");
    expect(withoutRule.discovery.instructions).toHaveLength(0);
  });

  it("discovery.ruleFrontmatter: omitting frontmatter parsing drops rule metadata", async () => {
    const baseline = await runCursorFixture("ignored-rules");
    const validRule = baseline.discovery.instructions.find(
      (instruction) =>
        (instruction as { path?: string }).path === ".cursor/rules/valid.mdc",
    ) as { description?: string; alwaysApply?: boolean } | undefined;
    expect(validRule?.description).toBe("Valid project rule");
    expect(validRule?.alwaysApply).toBe(true);
    const scopedRule = baseline.discovery.instructions.find(
      (instruction) =>
        (instruction as { path?: string }).path === ".cursor/rules/scoped.mdc",
    ) as { description?: string; globs?: string[] } | undefined;
    expect(scopedRule?.description).toBe("Scoped TypeScript rule");
    expect(scopedRule?.globs).toEqual(["**/*.ts"]);

    const instructions = await import(
      "../../../../src/adapters/cursor/discovery/instructions.js"
    );
    const discoverInstructions = instructions.discoverInstructions;
    vi.spyOn(instructions, "discoverInstructions").mockImplementation(
      async (scopes, projectPath) => {
        const discovered = await discoverInstructions(scopes, projectPath);
        return discovered.map((instruction) => {
          if (instruction.type !== "rule") {
            return instruction;
          }
          const { description: _d, alwaysApply: _a, globs: _g, ...rest } = instruction;
          return rest;
        });
      },
    );
    const withoutRule = await runCursorFixture("ignored-rules");
    for (const rulePath of [".cursor/rules/valid.mdc", ".cursor/rules/scoped.mdc"]) {
      const stripped = withoutRule.discovery.instructions.find(
        (instruction) => (instruction as { path?: string }).path === rulePath,
      ) as { description?: string; alwaysApply?: boolean; globs?: string[] } | undefined;
      expect(stripped?.description).toBeUndefined();
      expect(stripped?.alwaysApply).toBeUndefined();
      expect(stripped?.globs).toBeUndefined();
    }
  });
});
