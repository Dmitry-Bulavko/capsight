import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Agent } from "../../src/core/model/index.js";
import { SelectableAgentList, compareAgentsForList } from "../../src/ui/components/AgentList.js";
import { AgentsWorkspace } from "../../src/ui/components/AgentsWorkspace.js";
import { STATUS_LABELS } from "../../src/ui/components/AgentSelector.js";

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    name: "backend",
    description: "Backend agent",
    source: { platform: "claude", scope: "project", path: ".claude/agents/backend.md" },
    status: "active",
    configuration: { unknownFields: {} },
    isPluginAgent: false,
    ...overrides,
  };
}

describe("SelectableAgentList", () => {
  it("renders compact rows with name, scope, and status badge for every status", () => {
    const agents: Agent[] = (
      ["active", "invalid", "ambiguous", "shadowed", "unknown"] as Agent["status"][]
    ).map((status, index) =>
      makeAgent({
        id: `agent-${index}`,
        name: `agent-${status}`,
        status,
        ...(status === "ambiguous" || status === "shadowed"
          ? { collision: { candidates: [], rule: "A4", matrixRef: "A4" } }
          : {}),
      }),
    );

    const html = renderToString(
      createElement(SelectableAgentList, {
        agents,
        selectedAgentId: "agent-0",
        onAgentSelect: () => {},
      }),
    );

    for (const status of Object.keys(STATUS_LABELS) as Agent["status"][]) {
      expect(html).toContain(`status-badge status-${status}`);
      expect(html).toContain(STATUS_LABELS[status]);
    }

    expect(html).toContain('class="agent-list-compact-name">agent-active<');
    expect(html).toContain('class="agent-list-compact-scope">project<');
    expect(html).toContain('class="agent-list-compact-collision"');
    expect(html).toContain('role="listbox"');
  });

  it("marks the selected agent with aria-selected and selection class", () => {
    const html = renderToString(
      createElement(SelectableAgentList, {
        agents: [
          makeAgent({ id: "agent-a", name: "alpha" }),
          makeAgent({ id: "agent-b", name: "beta" }),
        ],
        selectedAgentId: "agent-b",
        onAgentSelect: () => {},
      }),
    );

    expect(html).toContain('agent-list-compact-row--selected');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('class="agent-list-compact-name">beta<');
    expect(html.match(/aria-selected="true"/g)?.length).toBe(1);
  });

  it("sorts project-scoped agents before builtins", () => {
    const html = renderToString(
      createElement(SelectableAgentList, {
        agents: [
          makeAgent({
            id: "builtin-1",
            name: "Explore",
            source: { platform: "claude", scope: "builtin" },
          }),
          makeAgent({
            id: "project-2",
            name: "reviewer",
            source: { platform: "claude", scope: "project", path: ".claude/agents/reviewer.md" },
          }),
          makeAgent({
            id: "project-1",
            name: "backend",
            source: { platform: "claude", scope: "project", path: ".claude/agents/backend.md" },
          }),
        ],
        selectedAgentId: "project-1",
        onAgentSelect: () => {},
      }),
    );

    const backendIndex = html.indexOf("backend");
    const reviewerIndex = html.indexOf("reviewer");
    const exploreIndex = html.indexOf("Explore");
    expect(backendIndex).toBeLessThan(reviewerIndex);
    expect(reviewerIndex).toBeLessThan(exploreIndex);
  });

  it("shows empty state when no agents are discovered", () => {
    const html = renderToString(
      createElement(SelectableAgentList, {
        agents: [],
        selectedAgentId: null,
        onAgentSelect: () => {},
      }),
    );

    expect(html).toContain("No agents discovered.");
  });
});

describe("compareAgentsForList", () => {
  it("ranks project before builtin and sorts by name within scope", () => {
    const project = makeAgent({ id: "p", name: "beta", source: { platform: "claude", scope: "project" } });
    const builtin = makeAgent({ id: "b", name: "alpha", source: { platform: "claude", scope: "builtin" } });
    expect(compareAgentsForList(project, builtin)).toBeLessThan(0);
    expect(compareAgentsForList(builtin, project)).toBeGreaterThan(0);
  });
});

describe("AgentsWorkspace agent list wiring", () => {
  it("renders selectable agent list in the left panel", () => {
    const agent = makeAgent();
    const html = renderToString(
      createElement(AgentsWorkspace, {
        platform: "claude",
        scanVersion: "1.0.0",
        agents: [agent],
        selectedAgentId: "agent-1",
        selectedAgent: agent,
        onAgentSelect: () => {},
        agentCenterView: "capabilities",
        onAgentCenterViewChange: () => {},
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
      }),
    );

    expect(html).toContain('data-testid="agents-workspace"');
    expect(html).toContain('aria-label="Agent list"');
    expect(html).toContain('class="agent-list-compact"');
    expect(html).toContain("Overview");
    expect(html).toContain("resource-detail-accordion");
    expect(html).toContain('class="agent-list-compact-name">backend<');
    expect(html).toContain('class="capsight-select context-preset-select"');
    expect(html).toContain("Declared configuration");
  });
});
