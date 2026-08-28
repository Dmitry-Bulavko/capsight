import { describe, expect, it } from "vitest";
import { resolvePermissionMode } from "../../../../src/adapters/claude/resolution/permissions.js";
import { buildExecutionContext } from "../../../../src/core/resolver/context.js";
import type { Agent, SourceInfo } from "../../../../src/core/model/index.js";

const AGENT_SOURCE: SourceInfo = {
  platform: "claude",
  scope: "project",
  path: ".claude/agents/backend.md",
};

function makeAgent(permissionMode?: Agent["configuration"]["permissionMode"]): Agent {
  return {
    id: "backend",
    name: "backend",
    description: "Backend agent",
    source: AGENT_SOURCE,
    status: "active",
    configuration: {
      permissionMode,
      unknownFields: {},
    },
    isPluginAgent: false,
  };
}

describe("resolvePermissionMode", () => {
  it("returns declared and effective when frontmatter applies", () => {
    const result = resolvePermissionMode(
      makeAgent("acceptEdits"),
      buildExecutionContext("foreground-subagent"),
      {},
    );

    expect(result).toMatchObject({
      declared: "acceptEdits",
      effective: "acceptEdits",
      ineffective: false,
    });
    expect(result.reasons[0]?.type).toBe("declared");
    expect(result.reasons.length).toBeGreaterThanOrEqual(1);
  });

  it("inherits default when nothing is declared and no parent mode", () => {
    const result = resolvePermissionMode(
      makeAgent(),
      buildExecutionContext("main-session"),
      {},
    );

    expect(result).toMatchObject({
      declared: undefined,
      effective: "default",
      ineffective: false,
    });
    expect(result.reasons[0]?.type).toBe("inherited");
  });

  it("parent bypassPermissions wins over agent frontmatter (P1)", () => {
    const result = resolvePermissionMode(
      makeAgent("acceptEdits"),
      buildExecutionContext("background-subagent", {
        parentPermissionMode: "bypassPermissions",
      }),
      {},
    );

    expect(result).toMatchObject({
      declared: "acceptEdits",
      effective: "bypassPermissions",
      ineffective: true,
    });
    expect(result.reasons[0]?.type).toBe("parent-mode");
    expect(result.reasons[0]?.matrixRef).toBe("P1");
  });

  it("parent acceptEdits wins over agent frontmatter (P1)", () => {
    const result = resolvePermissionMode(
      makeAgent("bypassPermissions"),
      buildExecutionContext("foreground-subagent", {
        parentPermissionMode: "acceptEdits",
      }),
      {},
    );

    expect(result).toMatchObject({
      declared: "bypassPermissions",
      effective: "acceptEdits",
      ineffective: true,
    });
    expect(result.reasons[0]?.matrixRef).toBe("P1");
  });

  it("parent auto ignores agent frontmatter even when values match (P2)", () => {
    const result = resolvePermissionMode(
      makeAgent("acceptEdits"),
      buildExecutionContext("background-subagent", {
        parentPermissionMode: "auto",
      }),
      {},
    );

    expect(result).toMatchObject({
      declared: "acceptEdits",
      effective: "auto",
      ineffective: true,
    });
    expect(result.reasons[0]?.type).toBe("parent-mode");
    expect(result.reasons[0]?.matrixRef).toBe("P2");
  });

  it("disableBypassPermissionsMode blocks declared bypassPermissions (P4)", () => {
    const result = resolvePermissionMode(
      makeAgent("bypassPermissions"),
      buildExecutionContext("foreground-subagent"),
      { disableBypassPermissionsMode: true },
    );

    expect(result).toMatchObject({
      declared: "bypassPermissions",
      effective: "default",
      ineffective: true,
    });
    expect(result.reasons[0]?.type).toBe("denied");
    expect(result.reasons[0]?.matrixRef).toBe("P4");
  });

  it("P4 falls back to parent mode when bypass is blocked", () => {
    const result = resolvePermissionMode(
      makeAgent("bypassPermissions"),
      buildExecutionContext("foreground-subagent", {
        parentPermissionMode: "dontAsk",
      }),
      { disableBypassPermissionsMode: true },
    );

    expect(result).toMatchObject({
      declared: "bypassPermissions",
      effective: "dontAsk",
      ineffective: true,
    });
  });

  it("P2 takes precedence over P4 when parent is auto", () => {
    const result = resolvePermissionMode(
      makeAgent("bypassPermissions"),
      buildExecutionContext("background-subagent", {
        parentPermissionMode: "auto",
      }),
      { disableBypassPermissionsMode: true },
    );

    expect(result).toMatchObject({
      declared: "bypassPermissions",
      effective: "auto",
      ineffective: true,
    });
    expect(result.reasons[0]?.matrixRef).toBe("P2");
  });

  it("marks declared ineffective in fork context (T3)", () => {
    const result = resolvePermissionMode(
      makeAgent("acceptEdits"),
      buildExecutionContext("fork", { parentPermissionMode: "auto" }),
      {},
    );

    expect(result).toMatchObject({
      declared: "acceptEdits",
      effective: "auto",
      ineffective: true,
    });
    expect(result.reasons[0]?.type).toBe("context-filter");
  });
});
