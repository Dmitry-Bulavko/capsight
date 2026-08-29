import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Agent } from "../../src/core/model/index.js";
import { CapsightSelect } from "../../src/ui/components/CapsightSelect.js";
import { AgentSelector } from "../../src/ui/components/AgentSelector.js";
import { ScanPanel } from "../../src/ui/components/ScanPanel.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const stylesPath = path.resolve(testDir, "../../src/ui/styles.css");

const sampleAgent: Agent = {
  id: "agent-1",
  name: "backend",
  description: "Backend agent",
  source: { platform: "claude", scope: "project", path: ".claude/agents/backend.md" },
  status: "active",
  configuration: { unknownFields: {} },
  isPluginAgent: false,
};

function noop(): void {}

describe("capsight-select custom listbox", () => {
  it("CapsightSelect renders custom trigger without native select", () => {
    const html = renderToString(
      createElement(CapsightSelect, {
        value: "claude",
        options: [
          { value: "claude", label: "Claude Code" },
          { value: "cursor", label: "Cursor" },
        ],
        onChange: noop,
        ariaLabel: "Platform",
        className: "capsight-select--platform",
      }),
    );

    expect(html).toContain('class="capsight-select capsight-select--platform"');
    expect(html).toContain('class="capsight-select-trigger"');
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Claude Code");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("<selectedcontent");
    expect(html).not.toContain("capsight-select-menu");
  });

  it("AgentSelector uses CapsightSelect with in-row status badge", () => {
    const html = renderToString(
      createElement(AgentSelector, {
        agents: [sampleAgent],
        selectedAgentId: sampleAgent.id,
        onAgentChange: noop,
      }),
    );

    expect(html).toContain('class="capsight-select capsight-select--agent"');
    expect(html).toContain('class="capsight-select-trigger"');
    expect(html).toContain('class="capsight-select-option-label"');
    expect(html).toContain('class="status-badge status-active"');
    expect(html).toContain(">Active<");
    expect(html).toContain(">backend<");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("agent-selector-status");
    expect(html).not.toContain("<selectedcontent");
  });

  it("ScanPanel platform selector uses CapsightSelect without badges", () => {
    const html = renderToString(
      createElement(ScanPanel, {
        projectPath: "",
        platform: "claude",
        onPlatformChange: noop,
        onBrowse: noop,
        onRescan: noop,
        onFallbackScan: noop,
        scanning: false,
        fallbackPath: "",
        onFallbackPathChange: noop,
        error: null,
      }),
    );

    expect(html).toContain('class="capsight-select capsight-select--platform"');
    expect(html).toContain('class="capsight-select-trigger"');
    expect(html).toContain("Claude Code");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("status-badge");
    expect(html).not.toContain("<selectedcontent");
  });

  it("CapsightSelect supports badge markup in option rows", () => {
    const html = renderToString(
      createElement(CapsightSelect, {
        value: "agent-1",
        options: [
          {
            value: "agent-1",
            label: "backend",
            badge: { text: "Active", tone: "active" },
          },
        ],
        onChange: noop,
        ariaLabel: "Agent",
      }),
    );

    expect(html).toContain('class="status-badge status-active"');
    expect(html).toContain(">backend<");
    expect(html).toContain(">Active<");
  });
});

describe("capsight-select CSS contract", () => {
  const css = readFileSync(stylesPath, "utf8");

  it("defines custom listbox trigger, menu, and option styling", () => {
    expect(css).toContain(".capsight-select-trigger");
    expect(css).toContain(".capsight-select-menu");
    expect(css).toContain(".capsight-select-option");
    expect(css).toContain(".capsight-select-option-label");
    expect(css).toMatch(/\.capsight-select-menu[\s\S]*gap:\s*0\.25rem/);
    expect(css).toMatch(/\.capsight-select-menu[\s\S]*margin-top:\s*0\.35rem/);
    expect(css).toMatch(/\.capsight-select-option[\s\S]*border:\s*1px solid #3c4043/);
    expect(css).toMatch(/\.capsight-select-option[\s\S]*border-radius:\s*4px/);
  });

  it("does not rely on native customizable select markup", () => {
    expect(css).not.toContain("appearance: base-select");
    expect(css).not.toContain("::picker(select)");
    expect(css).not.toContain("::picker-icon");
    expect(css).not.toContain(".capsight-select option");
    expect(css).not.toContain("@supports not (appearance: base-select)");
    expect(css).not.toContain(".capsight-select:open");
  });

  it("documents consistent interactive states", () => {
    expect(css).toContain(".capsight-select-trigger:hover:not(:disabled)");
    expect(css).toContain(".capsight-select-trigger:focus-visible");
    expect(css).toContain('.capsight-select-trigger[aria-expanded="true"]');
    expect(css).toContain(".capsight-select-trigger:disabled");
    expect(css).toContain('.capsight-select-trigger[aria-expanded="true"]::after');
  });

  it("styles agent and platform size modifiers", () => {
    expect(css).toContain(".capsight-select--agent");
    expect(css).toContain(".capsight-select--platform");
  });

  it("styles option hover and selected highlights", () => {
    expect(css).toContain(".capsight-select-option:hover");
    expect(css).toContain(".capsight-select-option--selected");
    expect(css).toMatch(/\.capsight-select-option:hover[\s\S]*background:\s*#5f6368/);
    expect(css).toMatch(/\.capsight-select-option--selected[\s\S]*background:\s*#252a38/);
  });

  it("styles compact in-row status badges", () => {
    expect(css).toContain(".capsight-select-option .status-badge");
  });
});
