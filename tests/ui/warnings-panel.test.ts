import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ResolvedCapability, Warning } from "../../src/core/model/index.js";
import {
  filterWarningsBySeverity,
  formatSourceLine,
  groupWarningsByCategory,
  parseHealthWarningFilter,
  shouldCollapseByCategory,
  warningRelatesToCapability,
  WarningsPanel,
} from "../../src/ui/components/WarningsPanel.js";

function makeWarning(overrides: Partial<Warning> = {}): Warning {
  return {
    category: "security-finding",
    severity: "warning",
    message:
      "Agent has Bash access. Tool-level restrictions are a guardrail, not a complete security boundary.",
    evidence: [
      {
        platform: "claude",
        scope: "project",
        path: ".claude/agents/forked.md",
      },
    ],
    ...overrides,
  };
}

function makeCapability(overrides: Partial<ResolvedCapability> = {}): ResolvedCapability {
  return {
    capabilityId: "Bash",
    kind: "tool",
    status: "available",
    enforcement: "unknown",
    sources: [
      {
        platform: "claude",
        scope: "unknown",
        fieldPath: "parent-session.tool-pool",
      },
    ],
    reasons: [
      {
        type: "context-filter",
        message: "Fork inherits parent session tool pool.",
        source: {
          platform: "claude",
          scope: "project",
          path: ".claude/agents/forked.md",
        },
      },
    ],
    ...overrides,
  };
}

describe("WarningsPanel helpers", () => {
  it("formats source lines like WhyPanel", () => {
    expect(
      formatSourceLine({
        platform: "claude",
        scope: "project",
        path: "/repo/.claude/agents/a.md",
        fieldPath: "frontmatter.permissionMode",
      }),
    ).toBe("/repo/.claude/agents/a.md — frontmatter.permissionMode");
  });

  it("filters warnings by severity for health drill-down", () => {
    const warnings = [
      makeWarning({ severity: "info", message: "info one" }),
      makeWarning({ severity: "warning", message: "warn one" }),
      makeWarning({ severity: "warning", message: "warn two" }),
    ];

    expect(filterWarningsBySeverity(warnings, "warning")).toHaveLength(2);
    expect(parseHealthWarningFilter("warnings:critical")).toBe("critical");
    expect(parseHealthWarningFilter("skills:claude")).toBeNull();
  });

  it("groups warnings by category without losing entries", () => {
    const warnings = [
      makeWarning({ category: "security-finding", message: "one" }),
      makeWarning({ category: "budget", message: "two" }),
      makeWarning({ category: "security-finding", message: "three" }),
    ];

    const groups = groupWarningsByCategory(warnings);
    expect(groups).toHaveLength(2);
    expect(groups.find(([category]) => category === "security-finding")?.[1]).toHaveLength(2);
    expect(shouldCollapseByCategory(warnings, 2)).toBe(true);
  });

  it("relates bash guardrail warnings to the Bash capability via agent path overlap", () => {
    const warning = makeWarning();
    const capability = makeCapability();
    expect(warningRelatesToCapability(warning, capability)).toBe(true);
    expect(warningRelatesToCapability(warning, makeCapability({ capabilityId: "Edit" }))).toBe(
      false,
    );
  });

  it("relates permission and MCP findings via evidence field paths", () => {
    const bypass = makeWarning({
      message: "Agent declares permissionMode bypassPermissions, which skips permission prompts.",
      evidence: [
        {
          platform: "claude",
          scope: "project",
          path: ".claude/agents/a.md",
          fieldPath: "frontmatter.permissionMode",
        },
      ],
    });
    const permissionCapability = makeCapability({
      capabilityId: "permission:bypassPermissions",
      kind: "permission",
      sources: [
        {
          platform: "claude",
          scope: "project",
          path: ".claude/agents/a.md",
          fieldPath: "frontmatter.permissionMode",
        },
      ],
      reasons: [],
    });
    expect(warningRelatesToCapability(bypass, permissionCapability)).toBe(true);

    const inlineMcp = makeWarning({
      evidence: [
        {
          platform: "claude",
          scope: "project",
          path: ".claude/agents/a.md",
          fieldPath: "frontmatter.mcpServers[0]",
        },
      ],
    });
    const mcpCapability = makeCapability({
      capabilityId: "inline-mcp:demo",
      kind: "mcp_server",
      sources: [
        {
          platform: "claude",
          scope: "project",
          path: ".claude/agents/a.md",
          fieldPath: "frontmatter.mcpServers[0]",
        },
      ],
      reasons: [],
    });
    expect(warningRelatesToCapability(inlineMcp, mcpCapability)).toBe(true);
  });
});

describe("WarningsPanel", () => {
  it("renders resolver messages verbatim with severity, category and evidence", () => {
    const message =
      "Agent has Bash access. Tool-level restrictions are a guardrail, not a complete security boundary.";
    const html = renderToString(
      createElement(WarningsPanel, {
        warnings: [makeWarning({ message })],
        agentId: "forked",
      }),
    );

    expect(html).toContain(message);
    expect(html).toContain("security-finding");
    expect(html).toContain("warning");
    expect(html).toContain(".claude/agents/forked.md");
    expect(html).toContain("warnings-panel");
  });

  it("shows the filtered count that matches severity drill-down input", () => {
    const html = renderToString(
      createElement(WarningsPanel, {
        warnings: [
          makeWarning({ severity: "info", message: "info msg" }),
          makeWarning({ severity: "warning", message: "warn msg" }),
        ],
        severityFilter: "warning",
        compact: true,
        title: "warning messages",
      }),
    );

    expect(html).toContain("warn msg");
    expect(html).not.toContain("info msg");
    expect(html).toContain('class="warnings-count"');
    expect(html).toContain(">1<");
  });
});
