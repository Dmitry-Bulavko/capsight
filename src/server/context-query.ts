import type { Request } from "express";
import type { ContextDefaultNotice } from "../core/model/context-presets.js";
import {
  DEFAULT_CONTEXT_NOTICE,
  DEFAULT_CONTEXT_PRESET,
  invalidContextPresetMessage,
  isContextPreset,
} from "../core/model/context-presets.js";
import type { ExecutionContext } from "../core/model/index.js";
import { PERMISSION_MODES, type PermissionMode } from "../adapters/claude/model/index.js";
import { buildExecutionContext } from "../adapters/claude/resolution/context.js";

export function getQueryString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}

export interface ParsedContextQuery {
  context: ExecutionContext;
  /** Present only when `?context=` was omitted, so responses carry the §4.3 caption. */
  contextDefault?: ContextDefaultNotice;
}

/**
 * Parse `?context=`, `?depth=`, `?parentMode=` into an ExecutionContext.
 * Defaults to §4.3's `background-subagent` and reports that it did so;
 * an unrecognized preset is rejected, never coerced.
 *
 * @see docs/SPEC.md §4.1, §4.3
 */
export function parseContextFromQuery(
  req: Request,
): ParsedContextQuery | { error: string } {
  const requested = getQueryString(req.query.context);
  const preset = requested ?? DEFAULT_CONTEXT_PRESET;

  if (!isContextPreset(preset)) {
    return { error: invalidContextPresetMessage(preset) };
  }

  const overrides: {
    depth?: number;
    parentPermissionMode?: PermissionMode;
  } = {};

  if (req.query.depth !== undefined) {
    const depthRaw = getQueryString(req.query.depth);
    if (depthRaw === undefined) {
      return { error: "Invalid depth" };
    }
    const depth = Number.parseInt(depthRaw, 10);
    if (Number.isNaN(depth)) {
      return { error: "Invalid depth" };
    }
    overrides.depth = depth;
  }

  const parentMode = getQueryString(req.query.parentMode);
  if (parentMode !== undefined) {
    if (!(PERMISSION_MODES as readonly string[]).includes(parentMode)) {
      return {
        error: `Invalid parentMode: ${parentMode}. Expected one of: ${PERMISSION_MODES.join(", ")}`,
      };
    }
    overrides.parentPermissionMode = parentMode as PermissionMode;
  }

  return {
    context: buildExecutionContext(preset, overrides),
    ...(requested === undefined ? { contextDefault: DEFAULT_CONTEXT_NOTICE } : {}),
  };
}
