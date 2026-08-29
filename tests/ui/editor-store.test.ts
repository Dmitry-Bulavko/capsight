import { describe, expect, it } from "vitest";
import type { EffectiveConfiguration } from "../../src/core/model/index.js";
import type { ClaudeAgent as Agent } from "../../src/adapters/claude/model/index.js";
import {
  baselineToolEnabled,
  clearAgentPending,
  collectEditableTools,
  countPendingChanges,
  createEmptyEditorState,
  desiredToolEnabled,
  toggleTool,
} from "../../src/ui/state/editor-store.js";

const AGENT: Agent = {
  id: "agent-1",
  name: "backend",
  description: "Backend agent",
  source: { platform: "claude", scope: "project", path: ".claude/agents/backend.md" },
  status: "active",
  configuration: {
    tools: ["Read", "Grep"],
    disallowedTools: ["Bash"],
    unknownFields: {},
  },
  isPluginAgent: false,
};

const mockVersion = {
  platform: "claude" as const,
  version: "2.1.0",
  raw: "2.1.0",
  detectedAt: "2026-01-01T00:00:00.000Z",
};

describe("editor-store", () => {
  it("collects editable tools from config and effective capabilities", () => {
    const effective: EffectiveConfiguration = {
      agentId: AGENT.id,
      context: {
        preset: "background-subagent",
        isMainSession: false,
        isBackground: true,
        isFork: false,
        isTeammate: false,
        depth: 0,
        maxDepth: 3,
      },
      version: mockVersion,
      capabilities: [
        {
          capabilityId: "Write",
          kind: "tool",
          status: "available",
          enforcement: "enforced",
          sources: [],
          reasons: [],
        },
      ],
      warnings: [],
      unknownRate: 0,
    };

    expect(collectEditableTools(AGENT, effective)).toEqual(["Bash", "Grep", "Read", "Write"]);
  });

  it("derives baseline enablement from frontmatter", () => {
    expect(baselineToolEnabled(AGENT, "Read")).toBe(true);
    expect(baselineToolEnabled(AGENT, "Grep")).toBe(true);
    expect(baselineToolEnabled(AGENT, "Bash")).toBe(false);
    expect(baselineToolEnabled(AGENT, "Write")).toBe(false);
  });

  it("tracks pending toggles without affecting baseline", () => {
    let pending = createEmptyEditorState();

    pending = toggleTool(pending, AGENT, "Write");
    expect(desiredToolEnabled(AGENT, pending, "Write")).toBe(true);
    expect(countPendingChanges(AGENT, pending)).toBe(1);
    expect(baselineToolEnabled(AGENT, "Write")).toBe(false);

    pending = toggleTool(pending, AGENT, "Write");
    expect(countPendingChanges(AGENT, pending)).toBe(0);

    pending = toggleTool(pending, AGENT, "Read");
    expect(desiredToolEnabled(AGENT, pending, "Read")).toBe(false);
    expect(countPendingChanges(AGENT, pending)).toBe(1);

    pending = clearAgentPending(pending, AGENT.id);
    expect(countPendingChanges(AGENT, pending)).toBe(0);
    expect(desiredToolEnabled(AGENT, pending, "Read")).toBe(true);
  });
});
