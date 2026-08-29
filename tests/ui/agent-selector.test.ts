import { describe, expect, it } from "vitest";
import type { Agent } from "../../src/core/model/index.js";
import {
  formatAgentOptionLabel,
  STATUS_LABELS,
} from "../../src/ui/components/AgentSelector.js";

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

describe("formatAgentOptionLabel", () => {
  it("uses em dash and full status label in the default selector", () => {
    expect(formatAgentOptionLabel(makeAgent(), false)).toBe("backend — Active");
  });

  it("uses middle dot and full status label in compact mode", () => {
    expect(formatAgentOptionLabel(makeAgent({ status: "invalid" }), true)).toBe(
      "backend · Invalid",
    );
  });

  it("covers every status label", () => {
    for (const status of Object.keys(STATUS_LABELS) as Agent["status"][]) {
      const label = formatAgentOptionLabel(makeAgent({ status }), false);
      expect(label).toContain(STATUS_LABELS[status]);
    }
  });
});
