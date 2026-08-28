import { describe, expect, it } from "vitest";
import {
  F2,
  F3,
  F4,
  F11,
  M1_DOC_FACTS,
  N2,
  P1,
  P2,
  P4,
  P5,
  T1,
  T2,
  T3,
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
  "P1",
  "P2",
  "P4",
  "P5",
] as const;

describe("facts", () => {
  it("exports all [doc] fact IDs used by M1 resolver code", () => {
    expect(M1_DOC_FACTS).toEqual([
      F2,
      F3,
      F4,
      F11,
      T1,
      T2,
      T3,
      P1,
      P2,
      P4,
      P5,
      N2,
    ]);
  });
});

describe("VERSION_MATRIX", () => {
  it("contains an entry for each M1 resolver rule", () => {
    const ids = VERSION_MATRIX.map((entry) => entry.id);
    expect(ids).toEqual([...M1_MATRIX_IDS]);
  });

  it("links tool rules to frontmatter facts", () => {
    const disallowed = VERSION_MATRIX.find((entry) => entry.id === "agent.disallowedTools");
    expect(disallowed?.factRefs).toEqual([F2, F3]);
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
      factRefs: [F2, F3],
    });
  });

  it("resolves permission matrix refs used by the resolver", () => {
    expect(lookupFeature("P1", "2.1.0")?.status).toBe("supported");
    expect(lookupFeature("P2", "2.1.100")?.factRefs).toEqual([P2]);
  });

  it("marks version-gated features unsupported below minVersion", () => {
    expect(lookupFeature("P4", "2.1.200")?.status).toBe("unsupported");
    expect(lookupFeature("P4", "2.1.223")?.status).toBe("supported");
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
