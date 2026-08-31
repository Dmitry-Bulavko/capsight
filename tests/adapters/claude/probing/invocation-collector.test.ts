import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  collectFromHookEvents,
  isPermissionDeniedHookEvent,
  isPreToolUseHookEvent,
  parseHookEvent,
  unwrapHookEventInput,
  validateHookEventRecording,
} from "../../../../src/adapters/claude/probing/invocation-collector.js";

const fixtureRecordingPath = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../fixtures/probes/hooks/claude-basic.json",
);

const collectorOptions = {
  claudeVersion: "2.1.219",
};

const preToolUseMainSession = {
  session_id: "abc123",
  cwd: "/home/user/my-project",
  permission_mode: "default",
  hook_event_name: "PreToolUse",
  tool_name: "Read",
  tool_input: { file_path: "/home/user/my-project/README.md" },
  tool_use_id: "toolu_read001",
};

const permissionDeniedAutoMode = {
  session_id: "abc123",
  cwd: "/Users/example/my-project",
  permission_mode: "auto",
  hook_event_name: "PermissionDenied",
  tool_name: "Bash",
  tool_input: {
    command: "rm -rf /tmp/build",
    description: "Clean build directory",
  },
  tool_use_id: "toolu_deny001",
  reason: "Blocked by classifier",
};

describe("hook event type guards", () => {
  it("recognizes documented PreToolUse shape", () => {
    expect(isPreToolUseHookEvent(preToolUseMainSession)).toBe(true);
    expect(isPermissionDeniedHookEvent(preToolUseMainSession)).toBe(false);
  });

  it("recognizes documented PermissionDenied shape", () => {
    expect(isPermissionDeniedHookEvent(permissionDeniedAutoMode)).toBe(true);
    expect(isPreToolUseHookEvent(permissionDeniedAutoMode)).toBe(false);
  });
});

describe("unwrapHookEventInput", () => {
  it("unwraps probe log lines with nested raw payload", () => {
    const wrapped = {
      capturedAt: "2026-08-31T12:00:00.000Z",
      event: "PreToolUse",
      tool_name: "Bash",
      raw: preToolUseMainSession,
    };

    expect(unwrapHookEventInput(wrapped)).toEqual({
      event: preToolUseMainSession,
      capturedAt: "2026-08-31T12:00:00.000Z",
    });
  });
});

describe("parseHookEvent", () => {
  it("maps PreToolUse to available + tool-invoked", () => {
    const result = parseHookEvent(preToolUseMainSession, collectorOptions);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toMatchObject({
      capabilityId: "Read",
      observedStatus: "available",
      evidenceKind: "tool-invoked",
      source: "hook",
      confidence: "high",
      claudeVersion: "2.1.219",
    });
    expect(result.value.context.preset).toBe("main-session");
    expect(result.value.context.parentPermissionMode).toBe("default");
  });

  it("maps subagent PreToolUse to explore preset context", () => {
    const result = parseHookEvent(
      {
        session_id: "abc123",
        cwd: "/home/user/my-project",
        hook_event_name: "PreToolUse",
        agent_id: "agent-1",
        agent_type: "Explore",
        tool_name: "Glob",
        tool_input: { pattern: "**/*.ts" },
        tool_use_id: "toolu_glob001",
      },
      collectorOptions,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.context).toMatchObject({
      preset: "explore",
      builtinKind: "explore",
      depth: 1,
    });
  });

  it("maps PermissionDenied to denied + permission-denied", () => {
    const result = parseHookEvent(permissionDeniedAutoMode, collectorOptions);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toMatchObject({
      capabilityId: "Bash",
      observedStatus: "denied",
      evidenceKind: "permission-denied",
      source: "hook",
      confidence: "high",
    });
    expect(result.value.context.parentPermissionMode).toBe("auto");
  });

  it("uses capturedAt from probe log wrapper as timestamp", () => {
    const result = parseHookEvent(
      {
        capturedAt: "2026-08-31T12:34:56.000Z",
        raw: preToolUseMainSession,
      },
      collectorOptions,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.timestamp).toBe("2026-08-31T12:34:56.000Z");
  });

  it("rejects unsupported hook events without producing denied records", () => {
    const result = parseHookEvent(
      {
        hook_event_name: "PostToolUse",
        session_id: "abc123",
        cwd: "/tmp",
        tool_name: "Bash",
        tool_input: {},
        tool_use_id: "toolu_post",
      },
      collectorOptions,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unsupported-event");
  });
});

describe("collectFromHookEvents", () => {
  it("collects only parseable invocation/denial events", () => {
    const capabilities = collectFromHookEvents(
      [
        preToolUseMainSession,
        permissionDeniedAutoMode,
        { hook_event_name: "Stop", session_id: "abc123" },
      ],
      collectorOptions,
    );

    expect(capabilities).toHaveLength(2);
    expect(capabilities.map((entry) => entry.observedStatus)).toEqual([
      "available",
      "denied",
    ]);
  });

  it("produces no records for silence / empty input (§9.3)", () => {
    expect(collectFromHookEvents([], collectorOptions)).toEqual([]);
    expect(
      collectFromHookEvents(
        [{ hook_event_name: "Stop", session_id: "abc123" }],
        collectorOptions,
      ),
    ).toEqual([]);
  });

  it("never infers denied from absence of PermissionDenied events", () => {
    const capabilities = collectFromHookEvents([preToolUseMainSession], collectorOptions);

    expect(capabilities).toHaveLength(1);
    expect(capabilities.every((entry) => entry.observedStatus !== "denied")).toBe(
      true,
    );
  });
});

describe("recorded hook-event fixture", () => {
  it("validates committed claude/basic payload schema without live hooks", async () => {
    const raw = JSON.parse(await readFile(fixtureRecordingPath, "utf8")) as unknown;

    expect(validateHookEventRecording(raw)).toBe(true);
    if (!validateHookEventRecording(raw)) return;

    expect(raw.meta.fixtureId).toBe("claude/basic");
    expect(raw.meta.provenance).toBe("doc-derived-synthetic");
    expect(raw.events.length).toBeGreaterThan(0);
  });

  it("parses all recorded samples into normalized ObservedCapability records", async () => {
    const raw = JSON.parse(await readFile(fixtureRecordingPath, "utf8")) as unknown;
    if (!validateHookEventRecording(raw)) {
      throw new Error("fixture failed validation");
    }

    const capabilities = collectFromHookEvents(raw.events, {
      claudeVersion: raw.meta.claudeCodeVersion,
    });

    expect(capabilities).toHaveLength(4);
    expect(capabilities[0]).toMatchObject({
      capabilityId: "Bash",
      observedStatus: "available",
      evidenceKind: "tool-invoked",
      timestamp: "2026-08-31T12:00:01.000Z",
    });
    expect(capabilities[1]).toMatchObject({
      capabilityId: "Glob",
      observedStatus: "available",
      context: { preset: "explore", builtinKind: "explore" },
    });
    expect(capabilities[2]).toMatchObject({
      capabilityId: "Bash",
      observedStatus: "denied",
      evidenceKind: "permission-denied",
      timestamp: "2026-08-31T12:00:10.000Z",
    });
    expect(capabilities[3]).toMatchObject({
      capabilityId: "mcp__github__search_repositories",
      observedStatus: "available",
    });
  });
});
