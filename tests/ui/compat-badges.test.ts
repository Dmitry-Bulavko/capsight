import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COMPAT_MATRIX_ENTRIES as CLAUDE_COMPAT } from "../../src/adapters/claude/version/matrix.js";
import { COMPAT_MATRIX_ENTRIES as CODEX_COMPAT } from "../../src/adapters/codex/version/matrix.js";
import { COMPAT_MATRIX_ENTRIES as CURSOR_COMPAT } from "../../src/adapters/cursor/version/matrix.js";
import {
  lookupCompat,
  mergeCompatEntries,
  type CompatVerdict,
} from "../../src/core/compat/index.js";
import { RESOURCE_CLASS } from "../../src/core/compat/resource-class.js";
import {
  assertCompatWording,
  buildCompatBadgeTrace,
  CompatBadges,
  resolveCompatBadgeState,
} from "../../src/ui/components/CompatBadges.js";

const ALL_COMPAT_ENTRIES = mergeCompatEntries(CLAUDE_COMPAT, CURSOR_COMPAT, CODEX_COMPAT);

function verdict(overrides: Partial<CompatVerdict> & Pick<CompatVerdict, "support">): CompatVerdict {
  return {
    enforcement: overrides.enforcement ?? "enforced",
    ...overrides,
  };
}

describe("resolveCompatBadgeState", () => {
  it("renders unknown when support is unknown", () => {
    expect(resolveCompatBadgeState(verdict({ support: "unknown", enforcement: "unknown" }))).toBe(
      "unknown",
    );
  });

  it("renders unknown when a founded verdict lacks a matrix ref", () => {
    expect(
      resolveCompatBadgeState(
        verdict({ support: "not-supported", enforcement: "enforced", reason: "test" }),
      ),
    ).toBe("unknown");
  });

  it("preserves supported and not-supported when matrix ref is present", () => {
    expect(
      resolveCompatBadgeState(
        verdict({
          support: "supported",
          matrixRef: "compat.claude.agent-markdown",
          reason: "reads agents",
        }),
      ),
    ).toBe("supported");
    expect(
      resolveCompatBadgeState(
        verdict({
          support: "not-supported",
          matrixRef: "compat.claude.instruction-agents-md",
          reason: "does not read AGENTS.md",
        }),
      ),
    ).toBe("not-supported");
  });
});

describe("buildCompatBadgeTrace", () => {
  it("includes matrix ref, fact refs, trust and statement for a founded verdict", () => {
    const trace = buildCompatBadgeTrace(
      "claude",
      verdict({
        support: "supported",
        matrixRef: "compat.claude.agent-markdown",
        reason: "Claude Code discovers agents from markdown files under configured agents directories.",
      }),
    );

    expect(trace.matrixRef).toBe("compat.claude.agent-markdown");
    expect(trace.factRefs.length).toBeGreaterThan(0);
    expect(trace.trustLabel).toBe("[doc]");
    expect(trace.statement).toMatch(/discovers agents/i);
  });

  it("leaves fact refs empty and trust neutral for unknown verdicts", () => {
    const trace = buildCompatBadgeTrace(
      "cursor",
      verdict({
        support: "unknown",
        enforcement: "unknown",
        reason: "No compatibility matrix entry; verdict is unknown.",
      }),
    );

    expect(trace.state).toBe("unknown");
    expect(trace.matrixRef).toBeUndefined();
    expect(trace.factRefs).toEqual([]);
    expect(trace.trustLabel).toBe("—");
  });
});

describe("CompatBadges", () => {
  it("renders one three-valued badge per platform", () => {
    const html = renderToString(
      createElement(CompatBadges, {
        compat: {
          claude: verdict({
            support: "supported",
            matrixRef: "compat.claude.agent-markdown",
            reason: "Claude Code discovers agents from markdown files.",
          }),
          cursor: verdict({
            support: "not-supported",
            matrixRef: "compat.cursor.agent-markdown",
            reason: "Cursor does not read markdown agent files from Claude directories.",
          }),
          codex: verdict({ support: "unknown", enforcement: "unknown", reason: "unknown" }),
        },
      }),
    );

    expect(html).toContain('class="compat-badge compat-badge-supported"');
    expect(html).toContain('class="compat-badge compat-badge-not-supported"');
    expect(html).toContain('class="compat-badge compat-badge-unknown"');
    expect(html.match(/compat-badge-platform/g)?.length).toBe(3);
  });

  it("does not use forbidden capability or breakage wording in matrix reasons", () => {
    for (const entry of ALL_COMPAT_ENTRIES) {
      expect(() => assertCompatWording(entry.reason)).not.toThrow();
      expect(entry.reason).not.toMatch(/will not work/i);
      expect(entry.reason).not.toMatch(/\bbroken\b/i);
    }
  });

  it("renders every badge as unknown when platform version is unknown", () => {
    for (const resourceClass of [
      RESOURCE_CLASS.AGENT_MARKDOWN,
      RESOURCE_CLASS.INSTRUCTION_AGENTS_MD,
      RESOURCE_CLASS.SKILL_DIRECTORY,
    ]) {
      for (const platform of ["claude", "cursor", "codex"] as const) {
        const resolved = lookupCompat({
          resourceClass,
          platform,
          version: "unknown",
          entries: ALL_COMPAT_ENTRIES,
        });
        expect(resolveCompatBadgeState(resolved)).toBe("unknown");
        expect(resolved.support).toBe("unknown");
        expect(resolved.matrixRef).toBeUndefined();
      }
    }
  });
});
