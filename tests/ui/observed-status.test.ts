import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  EffectiveConfiguration,
  ResolvedCapability,
} from "../../src/core/model/index.js";
import type { ObservedCapability } from "../../src/core/observed/index.js";
import type { CapabilityExplain } from "../../src/ui/api.js";
import { EffectiveCapabilities } from "../../src/ui/components/EffectiveCapabilities.js";
import {
  OBSERVED_STATUS_LABELS,
  ObservedDisclaimer,
  ObservedStatusBadge,
  ObservedWhySection,
  formatObservedEvidenceLine,
  resolveObservedStatus,
} from "../../src/ui/components/ObservedStatus.js";
import { WhyPanel } from "../../src/ui/components/WhyPanel.js";

function makeEffectiveCapability(
  overrides: Partial<ResolvedCapability> = {},
): ResolvedCapability {
  return {
    capabilityId: "Bash",
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

function makeObserved(
  overrides: Partial<ObservedCapability> = {},
): ObservedCapability {
  return {
    capabilityId: "Bash",
    context: {
      preset: "main-session",
      isMainSession: true,
      isBackground: false,
      isFork: false,
      isTeammate: false,
      depth: 0,
      maxDepth: 3,
    },
    observedStatus: "available",
    evidenceKind: "tool-invoked",
    source: "hook",
    confidence: "high",
    claudeVersion: "2.1.219",
    timestamp: "2026-08-31T12:00:01.000Z",
    ...overrides,
  };
}

function makeExplain(): CapabilityExplain {
  return {
    agentId: "backend",
    context: {
      preset: "main-session",
      isMainSession: true,
      isBackground: false,
      isFork: false,
      isTeammate: false,
      depth: 0,
      maxDepth: 3,
    },
    capability: {
      capabilityId: "Bash",
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
    },
  };
}

describe("ObservedStatus labels and helpers", () => {
  it("uses contract labels that avoid resolver ambiguity", () => {
    expect(OBSERVED_STATUS_LABELS.available).toBe("Observed: invoked");
    expect(OBSERVED_STATUS_LABELS["not-observed"]).toBe("Not observed");
    expect(OBSERVED_STATUS_LABELS.denied).toBe("Observed: denied");
  });

  it("defaults uncalled capabilities to not-observed when session is active", () => {
    const observedById = new Map([["Bash", makeObserved()]]);

    expect(resolveObservedStatus("Bash", observedById, true)).toBe("available");
    expect(resolveObservedStatus("Read", observedById, true)).toBe("not-observed");
    expect(resolveObservedStatus("Read", observedById, false)).toBeNull();
  });

  it("formats evidence lines for invoked and denied records", () => {
    expect(formatObservedEvidenceLine(makeObserved())).toContain("PreToolUse");
    expect(
      formatObservedEvidenceLine(
        makeObserved({
          observedStatus: "denied",
          evidenceKind: "permission-denied",
        }),
      ),
    ).toContain("PermissionDenied, auto-mode");
  });
});

describe("ObservedStatusBadge", () => {
  it("renders invoked label without forbidden resolver wording", () => {
    const html = renderToString(
      createElement(ObservedStatusBadge, { status: "available" }),
    );

    expect(html).toContain("Observed: invoked");
    expect(html).not.toContain("Allowed");
    expect(html).not.toContain("Available");
  });

  it("renders not-observed without denied or blocked wording", () => {
    const html = renderToString(
      createElement(ObservedStatusBadge, { status: "not-observed" }),
    );

    expect(html).toContain("Not observed");
    expect(html).not.toMatch(/\bDenied\b/);
    expect(html).not.toMatch(/\bBlocked\b/);
    expect(html).not.toMatch(/\bUnavailable\b/);
  });

  it("renders contract labels in compact mode instead of raw status tokens", () => {
    for (const status of ["available", "not-observed", "denied"] as const) {
      const html = renderToString(
        createElement(ObservedStatusBadge, { status, compact: true }),
      );

      expect(html).toContain(OBSERVED_STATUS_LABELS[status]);
      expect(html).not.toContain(`>${status}<`);
    }
  });
});

describe("ObservedDisclaimer", () => {
  it("shows the one-sided disclaimer copy", () => {
    const html = renderToString(createElement(ObservedDisclaimer, {}));

    expect(html).toContain("Invocation-only observation");
    expect(html).toContain("Not observed");
    expect(html).toContain("does not mean denied");
    expect(html).toContain("auto-mode only");
  });
});

describe("ObservedWhySection", () => {
  it("renders invoked evidence separately from resolver status", () => {
    const observedById = new Map([["Bash", makeObserved()]]);
    const html = renderToString(
      createElement(ObservedWhySection, {
        capabilityId: "Bash",
        observedById,
        sessionActive: true,
      }),
    );

    expect(html).toContain("Observed");
    expect(html).toContain("Observed: invoked");
    expect(html).toContain("Invoked during session");
    expect(html).toContain("PreToolUse");
    expect(html).toContain("observed-disclaimer");
  });

  it("renders not-observed when session is active but capability uncalled", () => {
    const html = renderToString(
      createElement(ObservedWhySection, {
        capabilityId: "Read",
        observedById: new Map([["Bash", makeObserved()]]),
        sessionActive: true,
      }),
    );

    expect(html).toContain("Not observed");
    expect(html).toContain("no invocation in this session");
  });

  it("renders denied observed status with auto-mode caveat", () => {
    const observedById = new Map([
      [
        "Bash",
        makeObserved({
          observedStatus: "denied",
          evidenceKind: "permission-denied",
        }),
      ],
    ]);
    const html = renderToString(
      createElement(ObservedWhySection, {
        capabilityId: "Bash",
        observedById,
        sessionActive: true,
      }),
    );

    expect(html).toContain("Observed: denied");
    expect(html).toContain("Denied (observed)");
    expect(html).toContain("PermissionDenied, auto-mode");
  });
});

describe("WhyPanel observed integration", () => {
  it("adds an OBSERVED block below resolver STATUS", () => {
    const observedById = new Map([["Bash", makeObserved()]]);
    const html = renderToString(
      createElement(WhyPanel, {
        explain: makeExplain(),
        onClose: () => {},
        observedById,
        observedSessionActive: true,
      }),
    );

    const statusIndex = html.indexOf(">Status<");
    const observedIndex = html.indexOf(">Observed<");
    expect(statusIndex).toBeGreaterThan(-1);
    expect(observedIndex).toBeGreaterThan(statusIndex);
    expect(html).toContain("observed-why-section");
  });
});

describe("EffectiveCapabilities observed badges", () => {
  it("shows observed badges and disclaimer when session data is present", () => {
    const observedById = new Map([
      ["Bash", makeObserved()],
      [
        "Glob",
        makeObserved({
          capabilityId: "Glob",
          observedStatus: "denied",
          evidenceKind: "permission-denied",
        }),
      ],
    ]);

    const html = renderToString(
      createElement(EffectiveCapabilities, {
        effective: {
          agentId: "backend",
          context: makeExplain().context,
          version: {
            platform: "claude",
            version: "2.1.219",
            raw: "2.1.219",
            detectedAt: "2026-08-31T00:00:00.000Z",
          },
          capabilities: [
            makeEffectiveCapability({ capabilityId: "Bash" }),
            makeEffectiveCapability({ capabilityId: "Glob" }),
            makeEffectiveCapability({ capabilityId: "Read" }),
          ],
          warnings: [],
          unknownRate: 0,
        },
        loading: false,
        error: null,
        selectedCapabilityId: null,
        onSelectCapability: () => {},
        observedById,
        observedSessionActive: true,
      }),
    );

    expect(html).toContain("observed-disclaimer");
    expect(html).toContain("observed-status-available");
    expect(html).toContain("observed-status-denied");
    expect(html).toContain("observed-status-not-observed");
  });
});
