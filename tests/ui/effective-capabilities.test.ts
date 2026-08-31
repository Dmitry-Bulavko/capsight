import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  EffectiveConfiguration,
  ExecutionContext,
  ResolvedCapability,
} from "../../src/core/model/index.js";
import {
  buildKindFilterOptions,
  EffectiveCapabilities,
  filterAndSortCapabilities,
  KIND_FILTER_ALL,
  KIND_LABELS,
} from "../../src/ui/components/EffectiveCapabilities.js";
import { ENFORCEMENT_LABELS } from "../../src/ui/components/WhyPanel.js";

function makeContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    preset: "foreground-subagent",
    isMainSession: false,
    isBackground: false,
    isFork: false,
    isTeammate: false,
    depth: 0,
    maxDepth: 3,
    ...overrides,
  };
}

function makeCapability(overrides: Partial<ResolvedCapability> = {}): ResolvedCapability {
  return {
    capabilityId: "Read",
    kind: "tool",
    status: "available",
    enforcement: "enforced",
    sources: [
      {
        platform: "claude",
        scope: "project",
        path: ".claude/agents/backend.md",
      },
    ],
    reasons: [
      {
        type: "declared",
        message: "Tool is allowed by agent configuration.",
      },
    ],
    ...overrides,
  };
}

function makeEffective(overrides: Partial<EffectiveConfiguration> = {}): EffectiveConfiguration {
  return {
    agentId: "backend",
    context: makeContext(),
    version: {
      platform: "claude",
      version: "2.1.0",
      raw: "2.1.0",
      detectedAt: "2026-01-01T00:00:00.000Z",
    },
    capabilities: [],
    warnings: [],
    unknownRate: 0,
    ...overrides,
  };
}

describe("EffectiveCapabilities helpers", () => {
  it("sorts capabilities by capabilityId deterministically", () => {
    const capabilities = [
      makeCapability({ capabilityId: "Write", kind: "tool" }),
      makeCapability({ capabilityId: "Bash", kind: "tool" }),
      makeCapability({ capabilityId: "Read", kind: "tool" }),
    ];

    expect(filterAndSortCapabilities(capabilities, KIND_FILTER_ALL).map((c) => c.capabilityId)).toEqual([
      "Bash",
      "Read",
      "Write",
    ]);
  });

  it("filters by kind without changing sort order", () => {
    const capabilities = [
      makeCapability({ capabilityId: "skill:lint", kind: "skill" }),
      makeCapability({ capabilityId: "Write", kind: "tool" }),
      makeCapability({ capabilityId: "Bash", kind: "tool" }),
      makeCapability({ capabilityId: "permission:auto", kind: "permission" }),
    ];

    expect(filterAndSortCapabilities(capabilities, "tool").map((c) => c.capabilityId)).toEqual([
      "Bash",
      "Write",
    ]);
  });

  it("builds kind filter options from present kinds in stable order", () => {
    const options = buildKindFilterOptions([
      makeCapability({ kind: "permission" }),
      makeCapability({ kind: "tool" }),
      makeCapability({ kind: "skill" }),
    ]);

    expect(options.map((option) => option.value)).toEqual([
      KIND_FILTER_ALL,
      "tool",
      "skill",
      "permission",
    ]);
  });
});

describe("EffectiveCapabilities component", () => {
  it("renders enforcement and kind on every row", () => {
    const effective = makeEffective({
      capabilities: [
        makeCapability({
          capabilityId: "Bash",
          kind: "tool",
          status: "available",
          enforcement: "enforced",
        }),
        makeCapability({
          capabilityId: "CLAUDE.md",
          kind: "instruction",
          status: "preloaded",
          enforcement: "advisory",
        }),
        makeCapability({
          capabilityId: "mcp__github__merge_pr",
          kind: "mcp_tool",
          status: "unknown",
          enforcement: "unknown",
        }),
      ],
    });

    const html = renderToString(
      createElement(EffectiveCapabilities, {
        effective,
        loading: false,
        error: null,
        selectedCapabilityId: null,
        onSelectCapability: () => {},
      }),
    );

    for (const capability of effective.capabilities) {
      expect(html).toContain(capability.capabilityId);
      expect(html).toContain(KIND_LABELS[capability.kind]);
      expect(html).toContain(ENFORCEMENT_LABELS[capability.enforcement]);
    }

    expect(html).toContain("enforcement-enforced");
    expect(html).toContain("enforcement-advisory");
    expect(html).toContain("enforcement-unknown");
    expect(html).toContain("capability-item-enforcement-unknown");
    expect(html).toContain('data-testid="capability-kind-filter"');
  });

  it("shows only matching kinds when filter is controlled", () => {
    const effective = makeEffective({
      capabilities: [
        makeCapability({ capabilityId: "Bash", kind: "tool" }),
        makeCapability({ capabilityId: "skill:lint", kind: "skill" }),
        makeCapability({ capabilityId: "permission:auto", kind: "permission" }),
      ],
    });

    const html = renderToString(
      createElement(EffectiveCapabilities, {
        effective,
        loading: false,
        error: null,
        selectedCapabilityId: null,
        onSelectCapability: () => {},
        kindFilter: "tool",
        onKindFilterChange: () => {},
      }),
    );

    expect(html).toContain("Bash");
    expect(html).not.toContain("skill:lint");
    expect(html).not.toContain("permission:auto");
  });

  it("keeps row buttons for Why panel selection", () => {
    const effective = makeEffective({
      capabilities: [makeCapability({ capabilityId: "Read" })],
    });

    const html = renderToString(
      createElement(EffectiveCapabilities, {
        effective,
        loading: false,
        error: null,
        selectedCapabilityId: "Read",
        onSelectCapability: () => {},
      }),
    );

    expect(html).toContain('type="button"');
    expect(html).toContain("capability-item");
    expect(html).toContain("capability-item-selected");
    expect(html).toContain("Read");
  });
});
