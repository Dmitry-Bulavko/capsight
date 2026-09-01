/**
 * OpenAI Codex CLI platform adapter.
 * @see docs/CODEX-FACTS.md
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
import type { CodexProjectSnapshot } from "./model/index.js";
import { resolveEffectiveConfiguration } from "./resolution/resolver.js";
import { detectCodexVersion } from "./version/index.js";

export const ADAPTER_ID = "codex" as const;

export const codexAdapter = createPlatformAdapter<CodexProjectSnapshot, WalkProjectScopesResult>({
  id: ADAPTER_ID,
  detectVersion: detectCodexVersion,
  walkProjectScopes,
  buildProjectSnapshot,
  resolveEffectiveConfiguration,
});

export async function scanProject(options: AdapterScanOptions): Promise<ProjectSnapshot> {
  const result = await codexAdapter.scan(options);
  return result.snapshot;
}

export async function resolveProject(
  snapshot: ProjectSnapshot,
  agentId: string,
  context: ExecutionContext,
): Promise<EffectiveConfiguration> {
  return codexAdapter.resolve(snapshot, agentId, context);
}
