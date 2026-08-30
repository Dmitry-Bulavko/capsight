import { describe, expect, it } from "vitest";
import { COMPAT_MATRIX_ENTRIES as CLAUDE_COMPAT } from "../../../src/adapters/claude/version/matrix.js";
import { COMPAT_MATRIX_ENTRIES as CODEX_COMPAT } from "../../../src/adapters/codex/version/matrix.js";
import { COMPAT_MATRIX_ENTRIES as CURSOR_COMPAT } from "../../../src/adapters/cursor/version/matrix.js";
import {
  ALL_RESOURCE_CLASSES,
  lookupCompat,
  mergeCompatEntries,
  type CompatMatrixEntry,
  type CompatSupport,
} from "../../../src/core/compat/index.js";

const PLATFORMS = ["claude", "cursor", "codex"] as const;

const ALL_COMPAT_ENTRIES = mergeCompatEntries(
  CLAUDE_COMPAT,
  CURSOR_COMPAT,
  CODEX_COMPAT,
);

const ENTRY_BY_ID = new Map<string, CompatMatrixEntry>(
  ALL_COMPAT_ENTRIES.map((entry) => [entry.id, entry]),
);

function foundedSupports(): CompatSupport[] {
  return ["supported", "not-supported"];
}

describe("lookupCompat", () => {
  it("returns unknown when no matrix entry exists — never not-supported", () => {
    const verdict = lookupCompat({
      resourceClass: "instruction@AGENTS.override.md",
      platform: "cursor",
      version: "1.0.0",
      entries: ALL_COMPAT_ENTRIES,
    });

    expect(verdict.support).toBe("unknown");
    expect(verdict.matrixRef).toBeUndefined();
  });

  it("returns unknown for every class × platform when version is unknown", () => {
    for (const resourceClass of ALL_RESOURCE_CLASSES) {
      for (const platform of PLATFORMS) {
        const verdict = lookupCompat({
          resourceClass,
          platform,
          version: "unknown",
          entries: ALL_COMPAT_ENTRIES,
        });

        expect(verdict.support).toBe("unknown");
        expect(verdict.enforcement).toBe("unknown");
        expect(verdict.matrixRef).toBeUndefined();
      }
    }
  });

  it("returns unknown when Claude version is below minVersion", () => {
    const verdict = lookupCompat({
      resourceClass: "instruction@AGENTS.md",
      platform: "claude",
      version: "2.0.0",
      entries: ALL_COMPAT_ENTRIES,
    });

    expect(verdict.support).toBe("unknown");
    expect(verdict.matrixRef).toBeUndefined();
  });

  it("records AGENTS.md as consumed by Cursor and Codex with matrix refs", () => {
    const cursor = lookupCompat({
      resourceClass: "instruction@AGENTS.md",
      platform: "cursor",
      version: "1.0.0",
      entries: ALL_COMPAT_ENTRIES,
    });
    const codex = lookupCompat({
      resourceClass: "instruction@AGENTS.md",
      platform: "codex",
      version: "1.0.0",
      entries: ALL_COMPAT_ENTRIES,
    });
    const claude = lookupCompat({
      resourceClass: "instruction@AGENTS.md",
      platform: "claude",
      version: "2.1.0",
      entries: ALL_COMPAT_ENTRIES,
    });

    expect(cursor.support).toBe("supported");
    expect(cursor.matrixRef).toBe("compat.cursor.instruction-agents-md");
    expect(codex.support).toBe("supported");
    expect(codex.matrixRef).toBe("compat.codex.instruction-agents-md");
    expect(claude.support).toBe("not-supported");
    expect(claude.matrixRef).toBe("compat.claude.instruction-agents-md");
    expect(claude.reason).toMatch(/does not read AGENTS\.md/i);
  });

  it("every supported or not-supported verdict carries a resolvable matrixRef", () => {
    for (const resourceClass of ALL_RESOURCE_CLASSES) {
      for (const platform of PLATFORMS) {
        const version = platform === "claude" ? "2.1.0" : "1.0.0";
        const verdict = lookupCompat({
          resourceClass,
          platform,
          version,
          entries: ALL_COMPAT_ENTRIES,
        });

        if (!foundedSupports().includes(verdict.support)) {
          continue;
        }

        expect(verdict.matrixRef, `${resourceClass} × ${platform}`).toBeTruthy();
        expect(ENTRY_BY_ID.has(verdict.matrixRef!), verdict.matrixRef).toBe(true);

        const entry = ENTRY_BY_ID.get(verdict.matrixRef!)!;
        expect(entry.resourceClass).toBe(resourceClass);
        expect(entry.platform).toBe(platform);
        expect(entry.support).toBe(verdict.support);
      }
    }
  });

  it("uses not-supported wording that states platform behaviour, not outcomes", () => {
    const verdict = lookupCompat({
      resourceClass: "instruction@AGENTS.md",
      platform: "claude",
      version: "2.1.0",
      entries: ALL_COMPAT_ENTRIES,
    });

    expect(verdict.reason).toMatch(/does not read/i);
    expect(verdict.reason).not.toMatch(/will not work/i);
  });
});

describe("compat matrix entries", () => {
  it("covers every resource class for Claude", () => {
    const classes = new Set(
      CLAUDE_COMPAT.map((entry) => entry.resourceClass),
    );
    expect([...classes].sort()).toEqual([...ALL_RESOURCE_CLASSES].sort());
  });

  it("covers every resource class for Cursor or leaves intentional unknowns documented", () => {
    const covered = new Set<string>(
      CURSOR_COMPAT.map((entry) => entry.resourceClass),
    );
    const intentionalUnknown = new Set<string>([
      "instruction@AGENTS.override.md",
      "mcp@inline-agent",
    ]);
    for (const resourceClass of ALL_RESOURCE_CLASSES) {
      if (intentionalUnknown.has(resourceClass)) {
        continue;
      }
      expect(covered.has(resourceClass), resourceClass).toBe(true);
    }
  });

  it("covers every resource class for Codex or leaves intentional unknowns", () => {
    const covered = new Set<string>(
      CODEX_COMPAT.map((entry) => entry.resourceClass),
    );
    const intentionalUnknown = new Set<string>(["instruction@CLAUDE.md"]);
    for (const resourceClass of ALL_RESOURCE_CLASSES) {
      if (intentionalUnknown.has(resourceClass)) {
        continue;
      }
      expect(covered.has(resourceClass), resourceClass).toBe(true);
    }
  });

  it("has no duplicate resourceClass × platform pairs across adapters", () => {
    const keys = ALL_COMPAT_ENTRIES.map(
      (entry) => `${entry.resourceClass}\0${entry.platform}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});
