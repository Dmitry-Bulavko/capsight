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
import { ENFORCEMENT_LABELS } from "../../src/ui/components/WhyPanel.js";

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

  it("relates warnings to capabilities via resolver-provided relatedCapabilityIds", () => {
    const warning = makeWarning({ relatedCapabilityIds: ["Bash"] });
    const capability = makeCapability();
    expect(warningRelatesToCapability(warning, capability)).toBe(true);
    expect(warningRelatesToCapability(warning, makeCapability({ capabilityId: "Edit" }))).toBe(
      false,
    );
  });

  it("does not relate warnings without relatedCapabilityIds", () => {
    const warning = makeWarning();
    const capability = makeCapability();
    expect(warningRelatesToCapability(warning, capability)).toBe(false);
  });

  it("links permission and MCP findings only to declared capability ids", () => {
    const bypass = makeWarning({
      message: "Agent declares permissionMode bypassPermissions, which skips permission prompts.",
      relatedCapabilityIds: ["permission:bypassPermissions"],
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
    expect(
      warningRelatesToCapability(
        bypass,
        makeCapability({ capabilityId: "permission:default", kind: "permission" }),
      ),
    ).toBe(false);

    const inlineMcp = makeWarning({
      relatedCapabilityIds: ["inline-mcp:0"],
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
      capabilityId: "inline-mcp:0",
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

  it("does not badge tools when warning only names a disallowedTools entry", () => {
    const disallowedOnlyWarning = makeWarning({
      relatedCapabilityIds: ["mcp__github__merge_pr"],
      evidence: [
        {
          platform: "claude",
          scope: "project",
          path: ".claude/agents/a.md",
          fieldPath: "frontmatter.disallowedTools[0]",
        },
      ],
    });
    expect(
      warningRelatesToCapability(
        disallowedOnlyWarning,
        makeCapability({ capabilityId: "Bash", kind: "tool" }),
      ),
    ).toBe(false);
    expect(
      warningRelatesToCapability(
        disallowedOnlyWarning,
        makeCapability({ capabilityId: "mcp__github__merge_pr", kind: "mcp_tool" }),
      ),
    ).toBe(true);
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

  it("renders enforcement badges for gated warnings", () => {
    const html = renderToString(
      createElement(WarningsPanel, {
        warnings: [
          makeWarning({ enforcement: "enforced", category: "ignored-field", message: "enforced msg" }),
          makeWarning({ enforcement: "advisory", category: "advisory", message: "advisory msg" }),
          makeWarning({ enforcement: "unknown", category: "unknown", message: "unknown msg" }),
        ],
      }),
    );

    expect(html).toContain(ENFORCEMENT_LABELS.enforced);
    expect(html).toContain(ENFORCEMENT_LABELS.advisory);
    expect(html).toContain(ENFORCEMENT_LABELS.unknown);
    expect(html).toContain("enforcement-enforced");
    expect(html).toContain("enforcement-advisory");
    expect(html).toContain("enforcement-unknown");
    expect(html).toContain("warnings-item-enforcement-unknown");
  });

  it("omits enforcement badge for security findings without enforcement", () => {
    const html = renderToString(
      createElement(WarningsPanel, {
        warnings: [makeWarning({ category: "security-finding", message: "security msg" })],
      }),
    );

    expect(html).toContain("security msg");
    expect(html).not.toContain("capability-enforcement-badge");
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
