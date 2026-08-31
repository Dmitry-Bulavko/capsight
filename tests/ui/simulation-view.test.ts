import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ManagedSimulationDelta, ManagedSimulationResult } from "../../src/ui/api.js";
import {
  countSimulationDelta,
  hasSimulationDelta,
  nonClaudeSimulationReason,
  SimulationView,
} from "../../src/ui/components/SimulationView.js";

function makeDelta(overrides: Partial<ManagedSimulationDelta> = {}): ManagedSimulationDelta {
  return {
    shadowedAgents: [],
    deniedTools: [],
    ignoredFields: [],
    modelChanges: [],
    ...overrides,
  };
}

function makeResult(overrides: Partial<ManagedSimulationResult> = {}): ManagedSimulationResult {
  return {
    snapshotId: "snapshot-1",
    bundlePath: "/mock/managed-bundle",
    context: {
      preset: "main-session",
      isMainSession: true,
      isBackground: false,
      isFork: false,
      isTeammate: false,
      depth: 0,
      maxDepth: 3,
    },
    delta: makeDelta(),
    ...overrides,
  };
}

describe("SimulationView helpers", () => {
  it("detects non-Claude platform block reason", () => {
    expect(nonClaudeSimulationReason("claude")).toBeNull();
    expect(nonClaudeSimulationReason("cursor")).toBe(
      'Managed simulation is not supported for platform "cursor" yet',
    );
  });

  it("counts delta entries across all sections", () => {
    const delta = makeDelta({
      shadowedAgents: [
        {
          agentId: "a1",
          agentName: "backend",
          previousStatus: "active",
          newStatus: "shadowed",
          shadowedBy: {
            platform: "claude",
            scope: "managed",
            path: "managed-bundle/agents/backend.md",
          },
        },
      ],
      deniedTools: [
        {
          agentId: "a1",
          agentName: "backend",
          capabilityId: "Write",
          previousStatus: "available",
          reason: 'Removed by disallowedTools pattern "Write" (F2, F3).',
        },
      ],
    });

    expect(hasSimulationDelta(delta)).toBe(true);
    expect(hasSimulationDelta(makeDelta())).toBe(false);
    expect(countSimulationDelta(delta)).toBe(2);
  });
});

describe("SimulationView", () => {
  it("prompts for simulation before a result exists", () => {
    const html = renderToString(
      createElement(SimulationView, {
        platform: "claude",
        result: null,
        onResult: () => {},
      }),
    );

    expect(html).toContain('data-testid="simulation-panel"');
    expect(html).toContain('data-testid="simulation-delta-prompt"');
    expect(html).not.toContain('data-testid="simulation-delta"');
  });

  it("renders all delta sections with causes", () => {
    const result = makeResult({
      delta: makeDelta({
        shadowedAgents: [
          {
            agentId: "agent-backend",
            agentName: "backend",
            previousStatus: "active",
            newStatus: "shadowed",
            shadowedBy: {
              platform: "claude",
              scope: "managed",
              path: "managed-bundle/agents/backend.md",
            },
          },
        ],
        deniedTools: [
          {
            agentId: "agent-backend",
            agentName: "backend",
            capabilityId: "Write",
            previousStatus: "available",
            reason: 'Removed by disallowedTools pattern "Write" (F2, F3).',
          },
        ],
        ignoredFields: [
          {
            agentId: "agent-backend",
            agentName: "backend",
            field: "permissionMode",
            message:
              'Declared permissionMode "bypassPermissions" is not effective in this context.',
            evidence: [
              {
                platform: "claude",
                scope: "managed",
                path: "managed-bundle/agents/backend.md",
                fieldPath: "frontmatter.permissionMode",
              },
            ],
          },
        ],
        modelChanges: [
          {
            agentId: "agent-backend",
            agentName: "backend",
            declared: "blocked-model",
            effective: "unknown",
            source: {
              platform: "claude",
              scope: "managed",
              path: "managed-bundle/agents/backend.md",
              fieldPath: "frontmatter.model",
            },
            matrixRef: "F8",
            enforcement: "enforced",
            effectiveEnforcement: "unknown",
          },
        ],
      }),
    });

    const html = renderToString(
      createElement(SimulationView, {
        platform: "claude",
        result,
        onResult: () => {},
      }),
    );

    expect(html).toContain('data-testid="simulation-delta-shadowed"');
    expect(html).toContain('data-testid="simulation-delta-denied"');
    expect(html).toContain('data-testid="simulation-delta-ignored"');
    expect(html).toContain('data-testid="simulation-delta-models"');
    expect(html).toContain("Shadowed by managed agent at");
    expect(html).toContain("Removed by disallowedTools pattern");
    expect(html).toContain("Write");
    expect(html).toContain("permissionMode");
    expect(html).toContain("blocked-model");
    expect(html).toContain("<code>blocked-model</code> → <code>unknown</code>");
    expect(html).toContain("F8");
    expect(html.replace(/<!-- -->/g, "")).toContain("Substitute model identity is unknown.");
    expect(html).not.toContain("Substitute model identity is enforced");
  });

  it("shows empty delta message when simulation has no impact", () => {
    const html = renderToString(
      createElement(SimulationView, {
        platform: "claude",
        result: makeResult(),
        onResult: () => {},
      }),
    );

    expect(html).toContain('data-testid="simulation-delta-empty"');
    expect(html).toContain("No policy impact detected");
  });

  it("is read-only with no apply action", () => {
    const result = makeResult({
      delta: makeDelta({
        deniedTools: [
          {
            agentId: "agent-backend",
            agentName: "backend",
            capabilityId: "Write",
            previousStatus: "available",
            reason: "Denied after overlay.",
          },
        ],
      }),
    });

    const html = renderToString(
      createElement(SimulationView, {
        platform: "claude",
        result,
        onResult: () => {},
      }),
    );

    expect(html).toContain("Read-only delta");
    expect(html).not.toMatch(/type="submit"/);
    expect(html).not.toMatch(/>\s*Apply\s*</i);
  });

  it("blocks simulation on non-Claude platform", () => {
    const html = renderToString(
      createElement(SimulationView, {
        platform: "cursor",
        result: null,
        onResult: () => {},
      }),
    );

    expect(html).toContain('data-testid="simulation-panel-blocked"');
    expect(html).toContain("Managed simulation is not supported");
    expect(html).not.toContain('data-testid="simulation-delta"');
  });
});
