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
  lookupFeature,
  VERSION_MATRIX,
} from "../../../../src/adapters/claude/version/matrix.js";

const M1_MATRIX_IDS = [
  "agent.disallowedTools",
  "agent.tools",
  "agent.toolAliases",
  "context.filter1",
  "context.filter2",
  "context.fork",
  "agent.depthLimit",
  FACT.P1,
  FACT.P2,
  FACT.P4,
  FACT.P5,
] as const;

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

  it("links tool rules to frontmatter facts", () => {
    const disallowed = VERSION_MATRIX.find((entry) => entry.id === "agent.disallowedTools");
    expect(disallowed?.factRefs).toEqual([FACT.F2, FACT.F3]);
    expect(disallowed?.fixture).toBe("tools-filters");
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
      confidence: "doc",
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
