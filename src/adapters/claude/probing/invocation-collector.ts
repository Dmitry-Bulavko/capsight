/**
 * S9P-05 — Parse PreToolUse / PermissionDenied hook events into ObservedCapability records.
 * Dev-only; not wired to scan. One-sided observation per SPEC §9.3.
 */

import { buildExecutionContext } from "../../../core/resolver/context.js";
import type { ExecutionContext } from "../../../core/model/index.js";
import {
  normalizeObservedCapability,
  type ObservedCapability,
} from "../../../core/observed/index.js";

export type HookEventProvenance = "live" | "doc-derived-synthetic";

/** Committed hook-event recording envelope for CI schema tests. */
export interface HookEventRecording {
  meta: {
    fixtureId: string;
    fixturePath?: string;
    recordedAt: string;
    provenance: HookEventProvenance;
    claudeCodeVersion: string;
    notes?: string;
  };
  events: unknown[];
}

export interface PreToolUseHookEvent {
  hook_event_name: "PreToolUse";
  session_id: string;
  cwd: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_use_id: string;
  transcript_path?: string;
  permission_mode?: string;
  agent_id?: string;
  agent_type?: string;
}

export interface PermissionDeniedHookEvent {
  hook_event_name: "PermissionDenied";
  session_id: string;
  cwd: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_use_id: string;
  reason: string;
  transcript_path?: string;
  permission_mode?: string;
  agent_id?: string;
  agent_type?: string;
}

export type ClaudeHookEvent = PreToolUseHookEvent | PermissionDeniedHookEvent;

export type ParseHookEventErrorCode =
  | "invalid-shape"
  | "unsupported-event"
  | "normalization-failed";

export interface ParseHookEventError {
  code: ParseHookEventErrorCode;
  message: string;
}

export type ParseHookEventResult =
  | { ok: true; value: ObservedCapability }
  | { ok: false; error: ParseHookEventError };

export interface InvocationCollectorOptions {
  claudeVersion: string;
  /** ISO timestamp for the observation; defaults to invocation time when omitted. */
  capturedAt?: string;
  maxDepth?: number;
  depth?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isPreToolUseShape(value: Record<string, unknown>): boolean {
  return (
    value.hook_event_name === "PreToolUse" &&
    isNonEmptyString(value.session_id) &&
    isNonEmptyString(value.cwd) &&
    isNonEmptyString(value.tool_name) &&
    isNonEmptyString(value.tool_use_id) &&
    isRecord(value.tool_input)
  );
}

function isPermissionDeniedShape(value: Record<string, unknown>): boolean {
  return (
    value.hook_event_name === "PermissionDenied" &&
    isNonEmptyString(value.session_id) &&
    isNonEmptyString(value.cwd) &&
    isNonEmptyString(value.tool_name) &&
    isNonEmptyString(value.tool_use_id) &&
    isNonEmptyString(value.reason) &&
    isRecord(value.tool_input)
  );
}

/** Type guard for documented PreToolUse hook stdin JSON. */
export function isPreToolUseHookEvent(value: unknown): value is PreToolUseHookEvent {
  return isRecord(value) && isPreToolUseShape(value);
}

/** Type guard for documented PermissionDenied hook stdin JSON. */
export function isPermissionDeniedHookEvent(
  value: unknown,
): value is PermissionDeniedHookEvent {
  return isRecord(value) && isPermissionDeniedShape(value);
}

/** Unwrap probe log lines that nest the hook payload under `raw`. */
export function unwrapHookEventInput(
  input: unknown,
): { event: unknown; capturedAt?: string } {
  if (!isRecord(input)) {
    return { event: input };
  }

  const capturedAt = typeof input.capturedAt === "string" ? input.capturedAt : undefined;
  if (isRecord(input.raw) && typeof input.raw.hook_event_name === "string") {
    return { event: input.raw, capturedAt };
  }

  return { event: input, capturedAt };
}

function executionContextFromHook(
  event: Pick<
    ClaudeHookEvent,
    "agent_id" | "agent_type" | "permission_mode"
  >,
  options: InvocationCollectorOptions,
): ExecutionContext {
  const maxDepth = options.maxDepth ?? 3;
  const overrides = {
    ...(options.depth !== undefined ? { depth: options.depth } : {}),
    ...(event.permission_mode !== undefined
      ? { parentPermissionMode: event.permission_mode }
      : {}),
  };

  if (!event.agent_id && !event.agent_type) {
    return buildExecutionContext("main-session", { maxDepth }, overrides);
  }

  if (event.agent_type === "Explore") {
    return buildExecutionContext(
      "explore",
      { maxDepth },
      { depth: options.depth ?? 1, ...overrides },
    );
  }

  if (event.agent_type === "Plan") {
    return buildExecutionContext(
      "plan",
      { maxDepth },
      { depth: options.depth ?? 1, ...overrides },
    );
  }

  return buildExecutionContext(
    "foreground-subagent",
    { maxDepth },
    { depth: options.depth ?? 1, ...overrides },
  );
}

function resolveTimestamp(
  options: InvocationCollectorOptions,
  capturedAt?: string,
): string {
  return capturedAt ?? options.capturedAt ?? new Date().toISOString();
}

function buildObservedCapability(
  event: ClaudeHookEvent,
  observedStatus: "available" | "denied",
  evidenceKind: "tool-invoked" | "permission-denied",
  options: InvocationCollectorOptions,
  capturedAt?: string,
): ParseHookEventResult {
  const record: ObservedCapability = {
    capabilityId: event.tool_name,
    context: executionContextFromHook(event, options),
    observedStatus,
    evidenceKind,
    source: "hook",
    confidence: "high",
    claudeVersion: options.claudeVersion,
    timestamp: resolveTimestamp(options, capturedAt),
  };

  const normalized = normalizeObservedCapability(record);
  if (!normalized.ok) {
    return {
      ok: false,
      error: {
        code: "normalization-failed",
        message: normalized.error.message,
      },
    };
  }

  return { ok: true, value: normalized.value };
}

/**
 * Parse one hook event (or probe log line) into an ObservedCapability.
 * Unknown or malformed events return an error — they never produce denied records.
 */
export function parseHookEvent(
  input: unknown,
  options: InvocationCollectorOptions,
): ParseHookEventResult {
  const { event, capturedAt } = unwrapHookEventInput(input);

  if (!isRecord(event)) {
    return {
      ok: false,
      error: { code: "invalid-shape", message: "Hook event must be an object" },
    };
  }

  if (isPreToolUseHookEvent(event)) {
    return buildObservedCapability(
      event,
      "available",
      "tool-invoked",
      options,
      capturedAt,
    );
  }

  if (isPermissionDeniedHookEvent(event)) {
    return buildObservedCapability(
      event,
      "denied",
      "permission-denied",
      options,
      capturedAt,
    );
  }

  const hookEventName =
    typeof event.hook_event_name === "string" ? event.hook_event_name : "unknown";

  return {
    ok: false,
    error: {
      code: "unsupported-event",
      message: `Unsupported hook event: ${hookEventName}`,
    },
  };
}

/**
 * Collect ObservedCapability records from hook events.
 * Skips invalid/unsupported events. Silence produces no records (§9.3).
 */
export function collectFromHookEvents(
  events: unknown[],
  options: InvocationCollectorOptions,
): ObservedCapability[] {
  const collected: ObservedCapability[] = [];

  for (const input of events) {
    const result = parseHookEvent(input, options);
    if (result.ok) {
      collected.push(result.value);
    }
  }

  return collected;
}

function isHookEventArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/** Validate a committed hook-event recording JSON envelope. */
export function validateHookEventRecording(
  value: unknown,
): value is HookEventRecording {
  if (!isRecord(value)) return false;
  if (!isRecord(value.meta)) return false;
  if (!isHookEventArray(value.events)) return false;

  const meta = value.meta;
  if (!isNonEmptyString(meta.fixtureId)) return false;
  if (!isNonEmptyString(meta.recordedAt)) return false;
  if (meta.provenance !== "live" && meta.provenance !== "doc-derived-synthetic") {
    return false;
  }
  if (!isNonEmptyString(meta.claudeCodeVersion)) return false;
  if (meta.fixturePath !== undefined && typeof meta.fixturePath !== "string") {
    return false;
  }
  if (meta.notes !== undefined && typeof meta.notes !== "string") return false;

  return true;
}
