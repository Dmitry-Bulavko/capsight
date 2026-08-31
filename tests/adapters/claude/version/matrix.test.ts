import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FACT,
  FACTS,
  factConfidence,
  factsByConfidence,
  isFactId,
  M1_DOC_FACTS,
  type FactId,
} from "../../../../src/adapters/claude/version/facts.js";
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
} from "../../../../src/adapters/claude/version/matrix.js";
import type { Warning } from "../../../../src/core/model/index.js";

const M1_MATRIX_IDS = [
  "agent.disallowedTools",
  "agent.tools",
  "agent.toolAliases",
  "context.filter1",
  "context.filter2",
  "context.foregroundBackground",
  "context.fork",
  "agent.depthLimit",
  "agent.depthLimitDefault",
  FACT.P1,
  FACT.P2,
  FACT.P4,
  FACT.P5,
  FACT.P3,
  "agent.collisionSameDir",
  "agent.collisionCrossScope",
  "agent.collisionNested",
  "agent.descriptionBudget",
  "agent.modelAllowlist",
  "agent.pluginFieldLimits",
  "skills.preload",
  "skills.disableModelInvocation",
  "skills.missing",
  "skills.denyBeatsAllowedTools",
  "skills.allowedToolsUntrusted",
  "skills.disallowedToolsActive",
  "skills.settingsOverrides",
  "trust.inlineMcp",
  "trust.frontmatterHooks",
  "trust.parentFolder",
  "trust.addDirSeparate",
  "instructions.hierarchy",
  "instructions.builtinKind",
  "instructions.subagentPrompt",
  "discovery.upwardWalkAgents",
  "discovery.recursiveAgentDirs",
  "discovery.pluginScopedId",
  "discovery.invalidAgentSkip",
  "discovery.pluginFilenameFallback",
  "agent.frontmatterRequired",
  "agent.toolsAgentTypesIgnored",
  "agent.toolsMissingAgent",
  "agent.modelResolution",
  "agent.initialPromptMainSession",
  "session.mainAgentPrompt",
  "session.mainInlineMcp",
  "skills.skillToolWithoutPreload",
  "skills.skillToolWhitelist",
  "discovery.addDirAgents",
  "discovery.addDirSkills",
  "discovery.commandNamePrecedence",
  "settings.layerPrecedence",
  "settings.denyPrecedence",
  "settings.mcpRuleSyntax",
  "settings.allowGlobIneffective",
  "settings.denyBareTool",
  "settings.bashPrefixRules",
  "settings.pathRules",
  "settings.webFetchRules",
  "settings.denySubagents",
  "settings.denySkills",
  "settings.ruleScope",
  "settings.additionalDirectories",
  "settings.projectMcpAutoApproval",
  "discovery.builtinInventory",
  "discovery.builtinNameOverride",
  "builtin.readOnly",
  FACT.E1,
  FACT.E2,
  "builtin.disableExplorePlan",
  "builtin.disableAllSdk",
  "environment.maxConcurrentSubagents",
  FACT.E8,
  "environment.settingsEnv",
] as const;

/** Facts behind resolver rules that emit `enforcement: "enforced"` (§0.1.3). */
const ENFORCED_RULE_FACTS: readonly FactId[] = [
  FACT.A1,
  FACT.A3,
  FACT.A9,
  FACT.A4,
  FACT.A10,
  FACT.F8,
  FACT.F9,
  FACT.K1,
  FACT.K4,
  FACT.K12,
  FACT.K5,
  FACT.I1,
  FACT.I2,
  FACT.B2,
  FACT.R1,
  FACT.R4,
  FACT.R5,
  FACT.N2,
  // §4.4 rule 7: a settings deny rule is an enforced verdict (S5, S2), and the
  // rules S3/S4 call inert are enforced claims of their own.
  FACT.S1,
  FACT.S2,
  FACT.S3,
  FACT.S4,
  FACT.S5,
];

const FIXTURES_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/claude",
);

const SRC_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../src",
);
const FACTS_MODULE = path.join(
  SRC_ROOT,
  "adapters/claude/version/facts.ts",
);

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

/** §3 trust levels, transcribed from the SPEC tables (not from resolver usage). */
const EXT_FACT_IDS: readonly FactId[] = [
  FACT.S1,
  FACT.S2,
  FACT.S3,
  FACT.S4,
  FACT.S5,
  FACT.S6,
  FACT.S7,
  FACT.S8,
  FACT.S10,
  FACT.S11,
  FACT.K8,
  FACT.K10,
  FACT.K11,
  FACT.K12,
  FACT.E9,
];

describe("facts", () => {
  it("exports all [doc] fact IDs used by M1 resolver code", () => {
    expect(M1_DOC_FACTS).toEqual([
      FACT.F2,
      FACT.F3,
      FACT.F4,
      FACT.F11,
      FACT.T1,
      FACT.T2,
      FACT.T3,
      FACT.P1,
      FACT.P2,
      FACT.P4,
      FACT.P5,
      FACT.N2,
    ]);
  });

  it("registers every §3 fact with id, section, statement and trust level", () => {
    expect(FACTS.length).toBeGreaterThan(0);
    for (const fact of FACTS) {
      expect(fact.id).toMatch(/^[A-Z]\d{1,2}$/);
      expect(fact.section).toMatch(/^3\.\d{1,2}$/);
      expect(fact.statement.length).toBeGreaterThan(0);
      expect(["doc", "ext", "spike"]).toContain(fact.confidence);
    }
  });

  it("registers each fact id exactly once", () => {
    const ids = FACTS.map((fact) => fact.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every §3 subsection", () => {
    const sections = new Set(FACTS.map((fact) => fact.section));
    expect([...sections].sort()).toEqual([
      "3.1",
      "3.10",
      "3.11",
      "3.12",
      "3.2",
      "3.3",
      "3.4",
      "3.5",
      "3.6",
      "3.7",
      "3.8",
      "3.9",
    ]);
  });

  it("gives every §3.11 environment row a stable id bound to its variable", () => {
    const envFacts = FACTS.filter((fact) => fact.section === "3.11");
    expect(envFacts).toHaveLength(9);
    for (const fact of envFacts) {
      expect(fact.id).toMatch(/^E\d$/);
      expect(fact.envVar).toBeTruthy();
    }
    expect(new Set(envFacts.map((fact) => fact.envVar)).size).toBe(9);
  });

  it("keeps [ext] facts at ext — SPEC trust level, not resolver reliance", () => {
    expect(factsByConfidence("ext").map((fact) => fact.id)).toEqual([
      ...EXT_FACT_IDS,
    ]);
    for (const id of EXT_FACT_IDS) {
      expect(factConfidence(id)).toBe("ext");
    }
    // S4 and K6 are both used by security-findings; only K6 is [doc].
    expect(factConfidence(FACT.S4)).toBe("ext");
    expect(factConfidence(FACT.K6)).toBe("doc");
    // S9 sits between [ext] rows in §3.5 and stays [doc].
    expect(factConfidence(FACT.S9)).toBe("doc");
    expect(factConfidence(FACT.K9)).toBe("doc");
  });

  it("marks every M1 resolver fact as [doc]", () => {
    for (const id of M1_DOC_FACTS) {
      expect(factConfidence(id)).toBe("doc");
    }
  });

  it("rejects unregistered ids", () => {
    expect(isFactId("F2")).toBe(true);
    expect(isFactId("F99")).toBe(false);
  });

  it("registration alone does not make a fact enforced or supported", () => {
    const referenced = new Set(
      VERSION_MATRIX.flatMap((entry) => entry.factRefs),
    );
    const unreferenced = FACTS.filter((fact) => !referenced.has(fact.id));
    expect(unreferenced.length).toBeGreaterThan(0);
    for (const fact of unreferenced) {
      // No matrix entry ⇒ SPEC §8.2: the feature resolves as unknown.
      expect(lookupFeature(fact.id, "2.1.233")).toBeUndefined();
    }
  });

  it("leaves no inline fact-id string literal in src/ outside facts.ts", () => {
    const pattern = new RegExp(
      `["'\`](${FACTS.map((fact) => fact.id).join("|")})["'\`]`,
    );
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC_ROOT)) {
      if (file === FACTS_MODULE) {
        continue;
      }
      for (const [index, line] of fs
        .readFileSync(file, "utf8")
        .split("\n")
        .entries()) {
        if (pattern.test(line)) {
          offenders.push(`${path.relative(SRC_ROOT, file)}:${index + 1}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe("VERSION_MATRIX", () => {
  it("contains an entry for each M1 resolver rule", () => {
    const ids = VERSION_MATRIX.map((entry) => entry.id);
    expect(ids).toEqual([...M1_MATRIX_IDS]);
  });

  it("covers every fact behind an enforced resolver rule", () => {
    const referenced = new Set(VERSION_MATRIX.flatMap((entry) => entry.factRefs));
    for (const id of ENFORCED_RULE_FACTS) {
      expect(referenced.has(id)).toBe(true);
    }
  });

  it("never names a fixture directory that lacks expected.json", () => {
    const claiming = VERSION_MATRIX.filter((entry) => entry.fixture);
    expect(claiming.length).toBeGreaterThan(0);
    for (const entry of claiming) {
      const expectedPath = path.join(FIXTURES_ROOT, entry.fixture!, "expected.json");
      expect(fs.existsSync(expectedPath), `${entry.id} -> ${entry.fixture!}`).toBe(true);
    }
  });

  it("makes every fixture entry state which facts it exercises entire (H1-28)", () => {
    for (const entry of VERSION_MATRIX) {
      if (!entry.fixture) {
        // No fixture, nothing to attribute: the field must stay unset so a
        // pending entry cannot smuggle a fact claim into the §11.4 numerator.
        expect(
          entry.verifiedFacts,
          `${entry.id} has no fixture and must not list verifiedFacts`,
        ).toBeUndefined();
        continue;
      }

      // The call is explicit: an entry with a fixture says which of its facts
      // the fixture exercises entire, even when the answer is none.
      expect(
        entry.verifiedFacts,
        `${entry.id} names a fixture and must declare verifiedFacts`,
      ).toBeDefined();

      for (const factId of entry.verifiedFacts ?? []) {
        expect(
          entry.factRefs.includes(factId),
          `${entry.id} claims ${factId}, which it does not reference`,
        ).toBe(true);
      }

      if ((entry.verifiedFacts ?? []).length > 0) {
        // Claiming a fact whole is exactly the claim `confidence` records.
        expect(
          entry.confidence,
          `${entry.id} claims fact evidence at confidence ${entry.confidence}`,
        ).not.toBe("doc");
      }
    }
  });

  it("keeps an entry that can only resolve unknown out of fixture confidence", () => {
    // An entry whose status is `unknown` by construction emits no confident
    // verdict, so no fixture can make its rule the operative cause of one.
    for (const entry of VERSION_MATRIX) {
      if (entry.status === "unknown") {
        expect(entry.confidence, entry.id).toBe("doc");
      }
    }
  });

  it("marks an entry whose fixture is not written yet as pending, not verified", () => {
    for (const entry of VERSION_MATRIX) {
      // Three states, exactly one of them declared: the fixture that carries
      // this entry, the fixture still owed for it, or the reason no fixture
      // could ever promote it (H1-28). Leaving all three unset would drop the
      // entry out of the owed-fixture backlog silently, which is the only way
      // "no pendingFixture left in the matrix" could be met without evidence.
      const declared = [
        entry.fixture,
        entry.pendingFixture,
        entry.noFixturePossible,
      ].filter((value) => value !== undefined);
      expect(
        declared.length,
        `${entry.id} must declare exactly one of fixture / pendingFixture / noFixturePossible`,
      ).toBe(1);

      if (!entry.pendingFixture) {
        continue;
      }
      // The corpus is fixed at 20 directories (§11.1): a pending entry points
      // at one of them, and stays [doc] until that fixture exists (H1-04).
      expect(
        fs.existsSync(path.join(FIXTURES_ROOT, entry.pendingFixture)),
        `${entry.id} -> ${entry.pendingFixture}`,
      ).toBe(true);
      expect(entry.confidence).toBe("doc");
    }
  });

  it("represents the N5 depth-limit history via changedIn", () => {
    const depth = VERSION_MATRIX.find((entry) => entry.id === "agent.depthLimit");
    expect(depth?.factRefs).toEqual([FACT.N1, FACT.N2, FACT.N3, FACT.N5, FACT.E3]);
    expect(depth?.changedIn).toEqual(["2.1.172", "2.1.217", "2.1.219"]);
  });

  it("links tool rules to frontmatter facts", () => {
    const disallowed = VERSION_MATRIX.find((entry) => entry.id === "agent.disallowedTools");
    expect(disallowed?.factRefs).toEqual([FACT.F2, FACT.F3]);
    expect(disallowed?.fixture).toBe("tools-filters");
  });

  it("documents SS-04 refusal for S6 prefix matching semantics", () => {
    const entry = VERSION_MATRIX.find((item) => item.id === "settings.bashPrefixRules");
    expect(entry?.notes).toMatch(/SS-04 evaluated/);
    expect(entry?.notes).toMatch(/noFixturePossible \(matching half\)/);
    expect(entry?.notes).toMatch(/§2\.3/);
    expect(entry?.verifiedFacts).toEqual([]);
  });

  it("documents SS-05 refusal for S7 glob matching semantics", () => {
    const entry = VERSION_MATRIX.find((item) => item.id === "settings.pathRules");
    expect(entry?.notes).toMatch(/SS-05 evaluated/);
    expect(entry?.notes).toMatch(/noFixturePossible \(matching half\)/);
    expect(entry?.notes).toMatch(/§2\.3/);
    expect(entry?.verifiedFacts).toEqual([]);
  });
});

describe("compareSemver", () => {
  it("orders patch versions", () => {
    expect(compareSemver("2.1.5", "2.1.10")).toBeLessThan(0);
    expect(compareSemver("2.1.223", "2.1.200")).toBeGreaterThan(0);
    expect(compareSemver("2.1.0", "2.1.0")).toBe(0);
  });

  it("returns null for unparsable versions", () => {
    expect(compareSemver("unknown", "2.1.0")).toBeNull();
  });
});

describe("lookupFeature", () => {
  it("returns supported entries for known features on 2.1.x", () => {
    const result = lookupFeature("agent.disallowedTools", "2.1.5");
    expect(result).toMatchObject({
      id: "agent.disallowedTools",
      status: "supported",
      // tools-filters pins F2 entire, so the entry is fixture-confident; F3 is
      // only partly exercised and is left out of `verifiedFacts` (H1-28).
      confidence: "fixture",
      verifiedFacts: [FACT.F2],
      factRefs: [FACT.F2, FACT.F3],
    });
  });

  it("resolves permission matrix refs used by the resolver", () => {
    expect(lookupFeature(FACT.P1, "2.1.0")?.status).toBe("supported");
    expect(lookupFeature(FACT.P2, "2.1.100")?.factRefs).toEqual([FACT.P2]);
  });

  it("marks version-gated features unsupported below minVersion", () => {
    expect(lookupFeature(FACT.P4, "2.1.200")?.status).toBe("unsupported");
    expect(lookupFeature(FACT.P4, "2.1.223")?.status).toBe("supported");
    expect(lookupFeature("agent.toolAliases", "2.1.50")?.status).toBe("unsupported");
    expect(lookupFeature("agent.toolAliases", "2.1.63")?.status).toBe("supported");
  });

  it("returns unknown status when CLI version is unavailable", () => {
    const result = lookupFeature("context.filter2", "unknown");
    expect(result?.status).toBe("unknown");
    expect(result?.id).toBe("context.filter2");
  });

  it("returns undefined for unknown feature ids", () => {
    expect(lookupFeature("agent.nonexistent", "2.1.5")).toBeUndefined();
  });
});

describe("resolveEnforcement", () => {
  const DETECTED = "2.1.233";

  /** Temporarily rewrite one live matrix entry, restoring it afterwards. */
  function withEntry(
    id: string,
    patch: Partial<FeatureCompatibility>,
    body: () => void,
  ): void {
    const entry = VERSION_MATRIX.find((candidate) => candidate.id === id) as
      | FeatureCompatibility
      | undefined;
    expect(entry, `matrix entry ${id}`).toBeDefined();
    const original = { ...entry! };
    Object.assign(entry!, patch);
    try {
      body();
    } finally {
      for (const key of Object.keys(entry!) as Array<keyof FeatureCompatibility>) {
        delete (entry as unknown as Record<string, unknown>)[key];
      }
      Object.assign(entry!, original);
    }
  }

  it("enforces a supported [doc] entry on a detected version", () => {
    expect(
      resolveEnforcement({ matrixId: MATRIX["agent.tools"], version: DETECTED }),
    ).toEqual({ enforcement: "enforced" });
  });

  it("keeps the rule's own baseline rather than upgrading it", () => {
    expect(
      resolveEnforcement({
        matrixId: MATRIX["instructions.hierarchy"],
        version: DETECTED,
        baseline: "advisory",
      }).enforcement,
    ).toBe("advisory");
  });

  it("resolves unknown for a rule whose matrix id is not registered (§8.2)", () => {
    const unregistered = "agent.neverRegistered";
    expect(isMatrixId(unregistered)).toBe(false);

    const decision = resolveEnforcement({
      matrixId: unregistered,
      version: DETECTED,
    });
    expect(decision.enforcement).toBe("unknown");
    expect(decision.reason?.type).toBe("version");
    expect(decision.reason?.matrixRef).toBe(unregistered);
  });

  it("resolves unknown for every registered entry when the CLI version is unknown (§8.3)", () => {
    for (const entry of VERSION_MATRIX) {
      const decision = resolveEnforcement({
        matrixId: entry.id,
        version: "unknown",
      });
      expect(decision.enforcement, entry.id).toBe("unknown");
      expect(decision.reason?.type, entry.id).toBe("version");
    }
  });

  it("resolves unknown below minVersion and for a non-supported status", () => {
    expect(
      resolveEnforcement({ matrixId: MATRIX[FACT.P4], version: "2.1.200" })
        .enforcement,
    ).toBe("unknown");
    expect(
      resolveEnforcement({ matrixId: MATRIX[FACT.P4], version: "2.1.223" })
        .enforcement,
    ).toBe("enforced");
    withEntry("agent.disallowedTools", { maxVersion: "2.1.10" }, () => {
      expect(
        resolveEnforcement({ matrixId: MATRIX["agent.disallowedTools"], version: "2.1.5" })
          .enforcement,
      ).toBe("enforced");
      expect(
        resolveEnforcement({ matrixId: MATRIX["agent.disallowedTools"], version: "2.1.11" })
          .enforcement,
      ).toBe("unknown");
    });
    // agent.collisionSameDir is registered with status "unknown" (A4).
    expect(
      resolveEnforcement({
        matrixId: MATRIX["agent.collisionSameDir"],
        version: DETECTED,
      }).enforcement,
    ).toBe("unknown");
  });

  it("lets an [ext] fact back enforced only at confidence >= fixture (§8.2)", () => {
    const id = MATRIX["trust.inlineMcp"];
    expect(factConfidence(FACT.S1)).toBe("ext");

    withEntry(id, { factRefs: [FACT.R1, FACT.S1], confidence: "fixture" }, () => {
      expect(
        resolveEnforcement({ matrixId: id, version: DETECTED }).enforcement,
      ).toBe("enforced");
    });

    // Flip the same fixture-backed entry back to doc: the [ext] fact can no
    // longer support an enforced verdict.
    withEntry(id, { factRefs: [FACT.R1, FACT.S1], confidence: "doc" }, () => {
      const decision = resolveEnforcement({ matrixId: id, version: DETECTED });
      expect(decision.enforcement).toBe("unknown");
      expect(decision.reason?.type).toBe("version");
      expect(decision.reason?.message).toContain(FACT.S1);
    });
  });

  it("treats a pendingFixture entry as evidence-free however it is annotated", () => {
    const id = MATRIX["agent.descriptionBudget"];
    withEntry(
      id,
      {
        factRefs: [FACT.A10, FACT.S1],
        confidence: "runtime-observed",
        pendingFixture: "invalid-agents",
      },
      () => {
        expect(
          resolveEnforcement({ matrixId: id, version: DETECTED }).enforcement,
        ).toBe("unknown");
      },
    );
  });
});

describe("gateWarning", () => {
  const DETECTED = "2.1.233";

  const budgetWarning: Warning = {
    category: "budget",
    severity: "warning",
    message: "Agent description budget exceeded.",
    evidence: [],
    enforcement: "advisory",
  };

  it("keeps the warning's own baseline when the matrix founds it", () => {
    const gated = gateWarning(
      budgetWarning,
      MATRIX["agent.descriptionBudget"],
      DETECTED,
    );

    expect(gated.enforcement).toBe("advisory");
    expect(gated.matrixRef).toBe("agent.descriptionBudget");
    expect(gated.message).toBe(budgetWarning.message);
  });

  it("reports the warning as undetermined when no entry backs it (§8.2)", () => {
    const gated = gateWarning(budgetWarning, "agent.notRegistered", DETECTED);

    expect(gated.enforcement).toBe("unknown");
    expect(gated.message).toContain("SPEC §8.2");
    // Category and severity say what the warning is about, not how sure we
    // are of it, so the gate leaves them alone.
    expect(gated.category).toBe("budget");
    expect(gated.severity).toBe("warning");
  });

  it("reports the warning as undetermined without a detected version (§8.3)", () => {
    const gated = gateWarning(
      budgetWarning,
      MATRIX["agent.descriptionBudget"],
      "unknown",
    );

    expect(gated.enforcement).toBe("unknown");
    expect(gated.message).toContain("SPEC §8.3");
  });
});

describe("gateCollision", () => {
  it("never founds an A4 winner, on any version", () => {
    for (const version of ["2.1.240", "2.1.0", "unknown"]) {
      const gate = gateCollision(FACT.A4, version);
      expect(gate.matrixRef, version).toBe("agent.collisionSameDir");
      expect(gate.enforcement, version).toBe("unknown");
      expect(gate.winnerUnfounded, version).toBe(true);
    }
  });

  it("founds the A3 winner only from the version the rule appears in", () => {
    expect(gateCollision(FACT.A3, "2.1.178")).toEqual({
      matrixRef: "agent.collisionNested",
      enforcement: "enforced",
      winnerUnfounded: false,
    });
    expect(gateCollision(FACT.A3, "2.1.177").winnerUnfounded).toBe(true);
    expect(gateCollision(FACT.A3, "unknown").winnerUnfounded).toBe(true);
  });

  it("founds the A1 cross-scope winner on a supported version", () => {
    expect(gateCollision(FACT.A1, "2.1.240")).toEqual({
      matrixRef: "agent.collisionCrossScope",
      enforcement: "enforced",
      winnerUnfounded: false,
    });
  });

  it("leaves the A1 cross-scope winner unfounded in degraded mode (§8.3)", () => {
    const gate = gateCollision(FACT.A1, "unknown");
    expect(gate.matrixRef).toBe("agent.collisionCrossScope");
    expect(gate.enforcement).toBe("unknown");
    expect(gate.winnerUnfounded).toBe(true);
  });

  it("gates every collision rule it can be called with", () => {
    // The rule parameter is the CollisionRule union, so there is no argument
    // for which the gate can return without a matrix entry behind it.
    for (const rule of [FACT.A1, FACT.A3, FACT.A4] as const) {
      const gate = gateCollision(rule, "2.1.240");
      expect(isMatrixId(gate.matrixRef), rule).toBe(true);
      expect(gate.enforcement, rule).toBeDefined();
    }
  });
});

describe("gateDiscovery", () => {
  it("founds the A9 and K12 add-dir rules on a detected version", () => {
    expect(gateDiscovery(MATRIX["discovery.addDirAgents"], "2.1.240")).toEqual({
      enforcement: "enforced",
      unfounded: false,
    });
    expect(gateDiscovery(MATRIX["discovery.addDirSkills"], "2.1.240")).toEqual({
      enforcement: "enforced",
      unfounded: false,
    });
  });

  it("leaves both add-dir rules unfounded in degraded mode (§8.3)", () => {
    expect(gateDiscovery(MATRIX["discovery.addDirAgents"], "unknown")).toEqual({
      enforcement: "unknown",
      unfounded: true,
    });
    expect(gateDiscovery(MATRIX["discovery.addDirSkills"], "unknown")).toEqual({
      enforcement: "unknown",
      unfounded: true,
    });
  });

  it("keeps K12 above documentation only through its fixture (§8.2)", () => {
    const entry = VERSION_MATRIX.find(
      (candidate) => candidate.id === "discovery.addDirSkills",
    );
    // K12 is [ext], so the entry may not rest on documentation alone.
    expect(factConfidence(FACT.K12)).toBe("ext");
    expect(entry?.confidence).toBe("fixture");
    expect(entry?.fixture).toBe("add-dir");
  });
});
