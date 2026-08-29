/**
 * Cursor execution context construction.
 */
import type { ContextPreset, ExecutionContext } from "../../../core/model/index.js";
import { buildExecutionContext as buildCoreExecutionContext } from "../../../core/resolver/context.js";

export interface ExecutionContextOverrides {
  depth?: number;
  maxDepth?: number;
  parentPermissionMode?: string;
}

const DEFAULT_MAX_DEPTH = 3;

export function buildExecutionContext(
  preset: ContextPreset,
  overrides: ExecutionContextOverrides = {},
): ExecutionContext {
  return buildCoreExecutionContext(
    preset,
    { maxDepth: DEFAULT_MAX_DEPTH },
    overrides,
  );
}
