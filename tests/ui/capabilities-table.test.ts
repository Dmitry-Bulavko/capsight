import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  EffectiveConfiguration,
  ExecutionContext,
  ResolvedCapability,
} from "../../src/core/model/index.js";
import type { ClaudeAgent as Agent } from "../../src/adapters/claude/model/index.js";
import {
  buildCapabilityTableRows,
  CapabilitiesTable,
} from "../../src/ui/components/CapabilitiesTable.js";
import { ENFORCEMENT_LABELS } from "../../src/ui/components/WhyPanel.js";
import { KIND_LABELS } from "../../src/ui/components/EffectiveCapabilities.js";

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
    sources: [{ platform: "claude", scope: "project", path: ".claude/agents/backend.md" }],
    reasons: [{ type: "declared", message: "Tool is allowed." }],
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

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "backend",
    name: "backend",
    status: "active",
    source: { platform: "claude", scope: "project", path: ".claude/agents/backend.md" },
    configuration: {
      tools: ["Read", "Write"],
      disallowedTools: ["Bash"],
      unknownFields: {},
    },
    ...overrides,
  } as Agent;
}

describe("buildCapabilityTableRows", () => {
  it("merges effective capabilities with editable tools from agent config", () => {
    const agent = makeAgent({
      configuration: { tools: ["Read"], disallowedTools: ["CustomTool"], unknownFields: {} },
    });
    const effective = makeEffective({
      capabilities: [
        makeCapability({ capabilityId: "Read", kind: "tool" }),
        makeCapability({ capabilityId: "skill:lint", kind: "skill" }),
      ],
    });

    expect(buildCapabilityTableRows(agent, effective).map((row) => row.id)).toEqual([
      "CustomTool",
      "Read",
      "skill:lint",
    ]);
  });

  it("marks only plain tool names as editable", () => {
    const agent = makeAgent({
      configuration: { tools: ["Read", "Bash(*)"], disallowedTools: [], unknownFields: {} },
    });
    const effective = makeEffective({
      capabilities: [
        makeCapability({ capabilityId: "Read" }),
        makeCapability({ capabilityId: "Bash(*)" }),
      ],
    });

    const rows = buildCapabilityTableRows(agent, effective);
    expect(rows.find((row) => row.id === "Read")?.editable).toBe(true);
    expect(rows.find((row) => row.id === "Bash(*)")?.editable).toBe(false);
  });
});

describe("CapabilitiesTable component", () => {
  it("renders table with badges and enable checkboxes for editable tools", () => {
    const agent = makeAgent();
    const effective = makeEffective({
      capabilities: [
        makeCapability({
          capabilityId: "Bash",
          kind: "tool",
          status: "denied",
          enforcement: "enforced",
        }),
        makeCapability({
          capabilityId: "CLAUDE.md",
          kind: "instruction",
          status: "preloaded",
          enforcement: "advisory",
        }),
      ],
    });

    const html = renderToString(
      createElement(CapabilitiesTable, {
        agent,
        effective,
        loading: false,
        error: null,
        selectedCapabilityId: "Bash",
        onSelectCapability: () => {},
        pending: { byAgent: {} },
        onToggleTool: () => {},
        onClearPending: () => {},
      }),
    );

    expect(html).toContain('data-testid="capabilities-table"');
    expect(html).toContain("<table");
    expect(html).toContain("Bash");
    expect(html).toContain("CLAUDE.md");
    expect(html).toContain(KIND_LABELS.tool);
    expect(html).toContain(KIND_LABELS.instruction);
    expect(html).toContain(ENFORCEMENT_LABELS.enforced);
    expect(html).toContain(ENFORCEMENT_LABELS.advisory);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("capsight-switch");
    expect(html).toContain("capabilities-table-row-selected");
    expect(html).toContain('data-testid="capability-kind-filter"');
  });
});
