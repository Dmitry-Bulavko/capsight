import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  EffectiveConfiguration,
  ExecutionContext,
  ResolvedCapability,
  Warning,
} from "../../src/core/model/index.js";
import {
  collectAffectedAnswers,
  DriftBanner,
  formatDriftSummary,
  resolveFeatureLabel,
  shouldCollapseAffectedList,
  shouldShowDriftBanner,
} from "../../src/ui/components/DriftBanner.js";

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
    capabilityId: "Agent",
    kind: "tool",
    status: "unknown",
    enforcement: "unknown",
    sources: [
      {
        platform: "claude",
        scope: "project",
        path: ".claude/agents/spawner.md",
      },
    ],
    reasons: [
      {
        type: "version",
        message:
          '"agent.depthLimitDefault" is outside the verified range for Claude Code 2.1.217; resolves as unknown.',
        matrixRef: "agent.depthLimitDefault",
      },
    ],
    ...overrides,
  };
}

function makeWarning(overrides: Partial<Warning> = {}): Warning {
  return {
    category: "version",
    severity: "info",
    message:
      '"agent.descriptionBudget" is unsupported on Claude Code 2.1.217; the warning is undetermined.',
    evidence: [],
    matrixRef: "agent.descriptionBudget",
    enforcement: "unknown",
    ...overrides,
  };
}

function makeEffective(overrides: Partial<EffectiveConfiguration> = {}): EffectiveConfiguration {
  return {
    agentId: "spawner",
    context: makeContext(),
    version: {
      platform: "claude",
      version: "2.1.217",
      raw: "2.1.217",
      detectedAt: "2026-01-01T00:00:00.000Z",
    },
    capabilities: [],
    warnings: [],
    unknownRate: 0,
    ...overrides,
  };
}

describe("DriftBanner helpers", () => {
  it("collects version-scoped capability downgrades", () => {
    const effective = makeEffective({
      capabilities: [makeCapability()],
    });

    const affected = collectAffectedAnswers(effective);
    expect(affected).toHaveLength(1);
    expect(affected[0]).toMatchObject({
      matrixRef: "agent.depthLimitDefault",
      capabilityId: "Agent",
      source: "capability",
    });
    expect(affected[0]?.featureLabel).toContain("Default subagent spawn depth");
  });

  it("collects version warnings without duplicating capability entries", () => {
    const effective = makeEffective({
      capabilities: [makeCapability()],
      warnings: [makeWarning()],
    });

    const affected = collectAffectedAnswers(effective);
    expect(affected).toHaveLength(2);
    expect(affected.some((entry) => entry.source === "warning")).toBe(true);
  });

  it("collects unknown-enforcement warnings with matrixRef regardless of message wording", () => {
    const effective = makeEffective({
      warnings: [
        makeWarning({
          category: "advisory",
          message: "Feature applicability changed for this platform version.",
          matrixRef: "agent.customRule",
          enforcement: "unknown",
        }),
      ],
    });

    const affected = collectAffectedAnswers(effective);
    expect(affected).toHaveLength(1);
    expect(affected[0]).toMatchObject({
      matrixRef: "agent.customRule",
      source: "warning",
    });
  });

  it("ignores warnings without matrixRef even when enforcement is unknown", () => {
    const effective = makeEffective({
      warnings: [
        makeWarning({
          category: "version",
          message: "Version-sensitive downgrade without structured matrix ref.",
          matrixRef: undefined,
          enforcement: "unknown",
        }),
      ],
    });

    expect(collectAffectedAnswers(effective)).toEqual([]);
  });

  it("dedupes repeated version reasons for the same capability", () => {
    const capability = makeCapability({
      reasons: [
        {
          type: "version",
          message: "first",
          matrixRef: "agent.depthLimitDefault",
        },
        {
          type: "version",
          message: "second",
          matrixRef: "agent.depthLimitDefault",
        },
      ],
    });

    expect(collectAffectedAnswers(makeEffective({ capabilities: [capability] }))).toHaveLength(1);
  });

  it("returns no affected answers when the effective config is clean", () => {
    const effective = makeEffective({
      capabilities: [
        makeCapability({
          status: "available",
          enforcement: "enforced",
          reasons: [{ type: "declared", message: "Allowed by tools pattern." }],
        }),
      ],
    });

    expect(collectAffectedAnswers(effective)).toEqual([]);
    expect(shouldShowDriftBanner(effective)).toBe(false);
  });

  it("formats scoped summary copy without global failure language", () => {
    expect(formatDriftSummary("claude", "2.1.217", 2)).toBe(
      "2 version-sensitive answers are unknown for Claude Code 2.1.217.",
    );
    expect(formatDriftSummary("claude", "unknown", 1)).toBe(
      "1 version-sensitive answer is unknown for an undetected version.",
    );
    expect(resolveFeatureLabel("missing.entry")).toBe("missing.entry");
  });

  it("collapses long affected lists by default", () => {
    expect(shouldCollapseAffectedList(5)).toBe(false);
    expect(shouldCollapseAffectedList(6)).toBe(true);
  });
});

describe("DriftBanner component", () => {
  it("renders the banner with scoped messaging and affected entries", () => {
    const html = renderToString(
      createElement(DriftBanner, {
        platform: "claude",
        version: "2.1.217",
        effective: makeEffective({
          capabilities: [makeCapability()],
        }),
      }),
    );

    expect(html).toContain('data-testid="drift-banner"');
    expect(html).toContain("1 version-sensitive answer is unknown");
    expect(html).toContain("The scan completed; unaffected capabilities keep their verdicts.");
    expect(html).not.toContain("unsupported platform");
    expect(html).toContain("agent.depthLimitDefault");
    expect(html).toContain("Default subagent spawn depth");
  });

  it("hides while loading or when no answers are affected", () => {
    expect(
      renderToString(
        createElement(DriftBanner, {
          platform: "claude",
          version: "2.1.217",
          effective: makeEffective(),
          loading: true,
        }),
      ),
    ).toBe("");

    expect(
      renderToString(
        createElement(DriftBanner, {
          platform: "claude",
          version: "2.1.219",
          effective: makeEffective({
            capabilities: [
              makeCapability({
                status: "available",
                enforcement: "enforced",
                reasons: [{ type: "declared", message: "Allowed." }],
              }),
            ],
          }),
        }),
      ),
    ).toBe("");
  });

  it("offers drill-down for long affected lists", () => {
    const capabilities = Array.from({ length: 6 }, (_, index) =>
      makeCapability({
        capabilityId: `Tool-${index}`,
        reasons: [
          {
            type: "version",
            message: `downgrade ${index}`,
            matrixRef: `agent.rule${index}`,
          },
        ],
      }),
    );

    const html = renderToString(
      createElement(DriftBanner, {
        platform: "claude",
        version: "2.1.217",
        effective: makeEffective({ capabilities }),
      }),
    );

    expect(html).toContain("Show all 6");
    expect(html).toContain("drift-banner-collapsed-note");
    expect(html).toContain("more affected");
  });
});
