import { createElement, type ComponentProps } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RESOURCE_CLASS } from "../../src/core/compat/resource-class.js";
import type { InspectionGraph } from "../../src/core/graph/build-graph.js";
import type { Agent } from "../../src/core/model/index.js";
import type { InventoryResourceWithCompat } from "../../src/server/routes/ecosystem.js";
import { AgentsWorkspace } from "../../src/ui/components/AgentsWorkspace.js";
import {
  capabilityIdFromInventoryResource,
  evaluateEcosystemBridge,
  findAgentIdsFromGraph,
  formatBridgeTransitionNotice,
  graphTargetNodeIdFromCapability,
  parseInventoryResourceId,
  ResourceDetailPanel,
} from "../../src/ui/components/ResourceDetailPanel.js";

function makeAgent(id: string, name = id): Agent {
  return {
    id,
    name,
    description: "Fixture agent",
    source: { platform: "claude", scope: "project", path: `.claude/agents/${id}.md` },
    status: "active",
    configuration: { unknownFields: {} },
    isPluginAgent: false,
  };
}

function makeResource(
  overrides: Partial<InventoryResourceWithCompat> = {},
): InventoryResourceWithCompat {
  return {
    id: "claude:agent:backend",
    kind: "agent",
    platform: "claude",
    scope: "project",
    resourceClass: RESOURCE_CLASS.AGENT_MARKDOWN,
    name: "backend",
    path: ".claude/agents/backend.md",
    compat: {
      claude: { support: "supported", enforcement: "enforced" },
      cursor: { support: "unknown", enforcement: "unknown" },
      codex: { support: "unknown", enforcement: "unknown" },
    },
    ...overrides,
  };
}

const sampleGraph: InspectionGraph = {
  context: {
    preset: "background-subagent",
    isMainSession: false,
    isBackground: true,
    isFork: false,
    isTeammate: false,
    depth: 1,
    maxDepth: 1,
  },
  nodes: [],
  edges: [
    {
      id: "agent:backend->skill:skill:api-helper",
      source: "agent:backend",
      target: "skill:skill:api-helper",
      kind: "agent-skill",
    },
    {
      id: "agent:reviewer->skill:skill:api-helper",
      source: "agent:reviewer",
      target: "skill:skill:api-helper",
      kind: "agent-skill",
    },
  ],
};

describe("ecosystem effective bridge helpers", () => {
  it("parses inventory resource ids with path-like suffixes", () => {
    expect(parseInventoryResourceId("claude:skill:skill:.claude/skills/api-helper/SKILL.md")).toEqual({
      platform: "claude",
      kind: "skill",
      resourceId: "skill:.claude/skills/api-helper/SKILL.md",
    });
  });

  it("maps skill and instruction resources to capability ids", () => {
    expect(
      capabilityIdFromInventoryResource(
        makeResource({
          id: "claude:skill:abc",
          kind: "skill",
          name: "api-helper",
        }),
      ),
    ).toBe("skill:api-helper");
    expect(
      capabilityIdFromInventoryResource(
        makeResource({
          id: "claude:instruction:abc",
          kind: "instruction",
          name: "CLAUDE.md",
          resourceClass: RESOURCE_CLASS.INSTRUCTION_CLAUDE_MD,
        }),
      ),
    ).toBe("instruction:CLAUDE.md");
  });

  it("builds graph target node ids for capability lookup", () => {
    expect(graphTargetNodeIdFromCapability("skill:api-helper", "skill")).toBe(
      "skill:skill:api-helper",
    );
    expect(graphTargetNodeIdFromCapability("instruction:CLAUDE.md", "instruction")).toBe(
      "instruction:instruction:CLAUDE.md",
    );
  });

  it("finds candidate agents from graph edges", () => {
    expect(findAgentIdsFromGraph(sampleGraph, "skill:skill:api-helper")).toEqual([
      "backend",
      "reviewer",
    ]);
  });

  it("marks non-Claude resources as disabled with a reason", () => {
    const evaluation = evaluateEcosystemBridge(
      makeResource({ platform: "cursor", id: "cursor:agent:main" }),
      [makeAgent("main")],
      null,
    );
    expect(evaluation).toEqual({
      state: "disabled",
      reason: "Effective resolution is Claude-only in this product.",
    });
  });

  it("bridges Claude agent resources directly", () => {
    const evaluation = evaluateEcosystemBridge(makeResource(), [makeAgent("backend")], null);
    expect(evaluation).toEqual({ state: "ready", target: { agentId: "backend" } });
  });

  it("asks for an agent when several agents resolve the same capability", () => {
    const evaluation = evaluateEcosystemBridge(
      makeResource({
        id: "claude:skill:abc",
        kind: "skill",
        name: "api-helper",
        resourceClass: RESOURCE_CLASS.SKILL_DIRECTORY,
      }),
      [makeAgent("backend"), makeAgent("reviewer")],
      sampleGraph,
    );
    expect(evaluation).toMatchObject({
      state: "choose-agent",
      capabilityId: "skill:api-helper",
      candidateAgentIds: ["backend", "reviewer"],
    });
  });

  it("states platform switch in the transition notice", () => {
    expect(formatBridgeTransitionNotice("backend", "cursor")).toContain(
      "switch to Claude",
    );
    expect(formatBridgeTransitionNotice("backend", "claude")).not.toContain("switch to Claude");
  });
});

describe("ResourceDetailPanel bridge UI", () => {
  it("shows disabled bridge reason for non-Claude resources", () => {
    const html = renderToString(
      createElement(ResourceDetailPanel, {
        detail: {
          resource: makeResource({ platform: "codex", id: "codex:agent:main" }),
          relatedFiles: [],
          relatedFolders: [],
          overlaps: [],
        },
        content: null,
        onClose: () => {},
        agents: [makeAgent("main")],
        bridgeEvaluation: {
          state: "disabled",
          reason: "Effective resolution is Claude-only in this product.",
        },
        currentPlatform: "codex",
        onBridgeRequest: () => {},
      }),
    );

    expect(html).toContain("Effective resolution is Claude-only in this product.");
    expect(html).toContain("data-testid=\"ecosystem-effective-bridge\"");
  });

  it("offers an open action for ready Claude agent bridges", () => {
    const html = renderToString(
      createElement(ResourceDetailPanel, {
        detail: {
          resource: makeResource(),
          relatedFiles: [],
          relatedFolders: [],
          overlaps: [],
        },
        content: null,
        onClose: () => {},
        agents: [makeAgent("backend")],
        bridgeEvaluation: { state: "ready", target: { agentId: "backend" } },
        currentPlatform: "claude",
        onBridgeRequest: () => {},
      }),
    );

    expect(html).toContain("Open effective resolution");
    expect(html).toContain("Effective resolution");
  });
});

function makeAgentsWorkspaceProps(
  overrides: Partial<ComponentProps<typeof AgentsWorkspace>> = {},
): ComponentProps<typeof AgentsWorkspace> {
  const agent = makeAgent("backend");
  return {
    platform: "claude",
    scanVersion: "1.0.0",
    agents: [agent],
    selectedAgentId: "backend",
    selectedAgent: agent,
    onAgentSelect: () => {},
    agentInspectorTab: "capabilities",
    onAgentInspectorTabChange: () => {},
    contextPreset: "main-session",
    onContextPresetChange: () => {},
    effectiveConfig: null,
    effectiveLoading: false,
    effectiveError: null,
    unknownRate: null,
    selectedCapabilityId: null,
    onSelectCapability: () => {},
    onCloseWhy: () => {},
    explainData: null,
    explainLoading: false,
    explainError: null,
    observedById: null,
    observedSessionActive: false,
    warningsScope: "agent",
    onWarningsScopeChange: () => {},
    displayedWarnings: [],
    allWarningsLoading: false,
    allWarningsError: null,
    editorPending: { byAgent: {} },
    editorPendingCount: 0,
    onToggleTool: () => {},
    onClearPending: () => {},
    ...overrides,
  };
}

describe("AgentsWorkspace ecosystem bridge return banner", () => {
  it("shows return banner on capabilities sub-view when bridge is active", () => {
    const html = renderToString(
      createElement(AgentsWorkspace, {
        ...makeAgentsWorkspaceProps(),
        ecosystemBridgeActive: true,
        onReturnToEcosystem: () => {},
      }),
    );

    expect(html).toContain('data-testid="ecosystem-bridge-return-banner"');
    expect(html).toContain("Opened from declared inventory");
    expect(html).toContain("Effective resolution — one context");
    expect(html).toContain("<code>main-session</code>");
    expect(html).toContain("Back to Ecosystem canvas");
  });

  it("hides return banner when bridge is not active", () => {
    const html = renderToString(
      createElement(AgentsWorkspace, {
        ...makeAgentsWorkspaceProps(),
        ecosystemBridgeActive: false,
      }),
    );

    expect(html).not.toContain('data-testid="ecosystem-bridge-return-banner"');
    expect(html).not.toContain("Back to Ecosystem canvas");
  });

  it("hides return banner outside capabilities sub-view even when bridge is active", () => {
    const html = renderToString(
      createElement(AgentsWorkspace, {
        ...makeAgentsWorkspaceProps({ agentInspectorTab: "overview" }),
        ecosystemBridgeActive: true,
        onReturnToEcosystem: () => {},
      }),
    );

    expect(html).not.toContain('data-testid="ecosystem-bridge-return-banner"');
  });
});
