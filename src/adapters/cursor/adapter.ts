/**
 * Cursor IDE platform adapter.
 * @see docs/CURSOR-FACTS.md
 */

import type {
  EffectiveConfiguration,
  ExecutionContext,
  ProjectSnapshot,
} from "../../core/model/index.js";
import type { AdapterScanOptions } from "../platform.js";
import { createPlatformAdapter } from "../shared/create-adapter.js";
import {
  buildProjectSnapshot,
  walkProjectScopes,
  type WalkProjectScopesResult,
} from "./discovery/index.js";
import type { CursorProjectSnapshot } from "./model/index.js";
import { resolveEffectiveConfiguration } from "./resolution/resolver.js";
import { detectCursorVersion } from "./version/index.js";

export const ADAPTER_ID = "cursor" as const;

export const cursorAdapter = createPlatformAdapter<CursorProjectSnapshot, WalkProjectScopesResult>({
  id: ADAPTER_ID,
  detectVersion: detectCursorVersion,
  walkProjectScopes,
  buildProjectSnapshot,
  resolveEffectiveConfiguration,
});

export async function scanProject(options: AdapterScanOptions): Promise<ProjectSnapshot> {
  const result = await cursorAdapter.scan(options);
  return result.snapshot;
}

export async function resolveProject(
  snapshot: ProjectSnapshot,
  agentId: string,
  context: ExecutionContext,
): Promise<EffectiveConfiguration> {
  return cursorAdapter.resolve(snapshot, agentId, context);
}
