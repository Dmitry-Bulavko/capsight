/**
 * Claude execution context construction: presets come from core, the depth
 * default and permission mode vocabulary come from this adapter.
 * @see docs/SPEC.md §4.2–§4.3, §12.2
 */
import type { ContextPreset, ExecutionContext } from "../../../core/model/index.js";
import { buildExecutionContext as buildCoreExecutionContext } from "../../../core/resolver/context.js";
import { getDefaultMaxDepth } from "../environment/depth.js";
import type { PermissionMode } from "../model/index.js";

export interface ExecutionContextOverrides {
  depth?: number;
  maxDepth?: number;
  parentPermissionMode?: PermissionMode;
}

/** Build an ExecutionContext with Claude depth defaults applied. */
export function buildExecutionContext(
  preset: ContextPreset,
  overrides: ExecutionContextOverrides = {},
): ExecutionContext {
  return buildCoreExecutionContext(
    preset,
    { maxDepth: getDefaultMaxDepth() },
    overrides,
  );
}
