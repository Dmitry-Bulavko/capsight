/**
 * Single source of truth for the §4.3 execution-context presets: the list, the
 * default preset and the caption that must accompany it.
 *
 * Every surface (CLI, HTTP API, UI) imports these; duplicating them is how the
 * CLI and the HTTP routes drifted apart in the first place.
 *
 * @see docs/SPEC.md §4.1, §4.3, T6
 */
import type { ContextPreset } from "./index.js";

/** Every §4.3 preset, in spec order. */
export const CONTEXT_PRESETS: readonly ContextPreset[] = [
  "main-session",
  "foreground-subagent",
  "background-subagent",
  "fork",
  "explore",
  "plan",
  "teammate",
] as const;

/** §4.3: the actual default mode in an interactive session (T6). */
export const DEFAULT_CONTEXT_PRESET: ContextPreset = "background-subagent";

/** §4.3 requires the caption explaining why this default was chosen. */
export const DEFAULT_CONTEXT_REASON =
  "Default context is background-subagent because it is the actual default mode in an interactive session (T6).";

/**
 * Emitted by any surface that applied the default preset instead of an explicit
 * choice. §4.1 forbids presenting a result without its context.
 */
export interface ContextDefaultNotice {
  preset: ContextPreset;
  reason: string;
}

export const DEFAULT_CONTEXT_NOTICE: ContextDefaultNotice = {
  preset: DEFAULT_CONTEXT_PRESET,
  reason: DEFAULT_CONTEXT_REASON,
};

export function isContextPreset(value: string): value is ContextPreset {
  return (CONTEXT_PRESETS as readonly string[]).includes(value);
}

/** Rejection message: never silently default an unrecognized preset. */
export function invalidContextPresetMessage(preset: string): string {
  return `Invalid context preset: ${preset}. Expected one of: ${CONTEXT_PRESETS.join(", ")}`;
}
