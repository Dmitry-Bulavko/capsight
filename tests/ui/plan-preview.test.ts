import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PlanResult } from "../../src/application/plan.js";
import {
  formatToolList,
  hasPlanChanges,
  nonClaudePlanReason,
  PlanPreview,
  snapshotStaleWarning,
} from "../../src/ui/components/PlanPreview.js";

function makePlan(overrides: Partial<PlanResult> = {}): PlanResult {
  return {
    snapshotId: "snapshot-current",
    editSnapshotId: "snapshot-edit",
    files: [],
    warnings: [],
    ...overrides,
  };
}

describe("PlanPreview helpers", () => {
  it("formats tool lists for empty and populated arrays", () => {
    expect(formatToolList(undefined)).toBe("(empty)");
    expect(formatToolList([])).toBe("(empty)");
    expect(formatToolList(["Grep", "Read"])).toBe("Grep, Read");
  });

  it("detects plan file changes", () => {
    expect(hasPlanChanges(null)).toBe(false);
    expect(hasPlanChanges(makePlan())).toBe(false);
    expect(
      hasPlanChanges(
        makePlan({
          files: [
            {
              path: "/mock/.claude/agents/backend.md",
              agentId: "agent-backend",
              agentName: "backend",
              changes: [{ field: "tools", before: ["Read"], after: ["Read", "Write"] }],
            },
          ],
        }),
      ),
    ).toBe(true);
  });

  it("extracts snapshot stale warning message", () => {
    expect(snapshotStaleWarning(makePlan())).toBeNull();
    expect(
      snapshotStaleWarning(
        makePlan({
          warnings: [
            {
              code: "snapshot-id-changed",
              message: "Project configuration changed since editing started.",
              editSnapshotId: "old",
              currentSnapshotId: "new",
            },
          ],
        }),
      ),
    ).toBe("Project configuration changed since editing started.");
  });

  it("names non-Claude platform reason", () => {
    expect(nonClaudePlanReason("claude")).toBeNull();
    expect(nonClaudePlanReason("cursor")).toBe(
      'Configuration planning is not supported for platform "cursor" yet',
    );
  });
});

describe("PlanPreview", () => {
  it("renders nothing without pending edits", () => {
    const html = renderToString(
      createElement(PlanPreview, {
        platform: "claude",
        plan: null,
        loading: false,
        error: null,
        hasPendingEdits: false,
      }),
    );
    expect(html).toBe("");
  });

  it("renders exact file and field diff from the plan", () => {
    const plan = makePlan({
      files: [
        {
          path: "/mock/project/.claude/agents/backend.md",
          agentId: "agent-backend",
          agentName: "backend",
          changes: [
            {
              field: "tools",
              before: ["Grep", "Read"],
              after: ["Grep", "Read", "Write"],
            },
          ],
        },
      ],
    });

    const html = renderToString(
      createElement(PlanPreview, {
        platform: "claude",
        plan,
        loading: false,
        error: null,
        hasPendingEdits: true,
      }),
    );

    expect(html).toContain('data-testid="plan-file-change"');
    expect(html).toContain("/mock/project/.claude/agents/backend.md");
    expect(html).toContain("tools");
    expect(html).toContain("Grep, Read");
    expect(html).toContain("Grep, Read, Write");
    expect(html).not.toContain("verified");
  });

  it("names the CLI apply command and includes no apply button", () => {
    const plan = makePlan({
      files: [
        {
          path: "/mock/project/.claude/agents/backend.md",
          agentId: "agent-backend",
          agentName: "backend",
          changes: [{ field: "tools", before: ["Read"], after: ["Read", "Write"] }],
        },
      ],
    });

    const html = renderToString(
      createElement(PlanPreview, {
        platform: "claude",
        plan,
        loading: false,
        error: null,
        hasPendingEdits: true,
      }),
    );

    expect(html).toContain("agent-manager apply");
    expect(html).not.toMatch(/type="submit"/);
    expect(html).not.toMatch(/>\s*Apply\s*</i);
  });

  it("surfaces snapshot id change in the preview", () => {
    const plan = makePlan({
      editSnapshotId: "stale-id",
      snapshotId: "snapshot-current",
      warnings: [
        {
          code: "snapshot-id-changed",
          message: "Project configuration changed since editing started. Review the diff before applying.",
          editSnapshotId: "stale-id",
          currentSnapshotId: "snapshot-current",
        },
      ],
    });

    const html = renderToString(
      createElement(PlanPreview, {
        platform: "claude",
        plan,
        loading: false,
        error: null,
        hasPendingEdits: true,
      }),
    );

    expect(html).toContain('data-testid="plan-preview-stale"');
    expect(html).toContain("stale-id");
    expect(html).toContain("snapshot-current");
  });

  it("disables preview on non-Claude platform with reason visible", () => {
    const html = renderToString(
      createElement(PlanPreview, {
        platform: "cursor",
        plan: null,
        loading: false,
        error: null,
        hasPendingEdits: true,
      }),
    );

    expect(html).toContain('data-testid="plan-preview-platform-blocked"');
    expect(html).toContain("cursor");
    expect(html).toContain("Configuration planning is not supported");
    expect(html).not.toContain('data-testid="plan-file-change"');
  });
});
