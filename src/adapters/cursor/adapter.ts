/**
 * Cursor IDE platform adapter.
 * @see docs/CURSOR-FACTS.md
 */

import path from "node:path";
import type {
  EffectiveConfiguration,
  ExecutionContext,
  ProjectSnapshot,
} from "../../core/model/index.js";
import type { AdapterScanOptions, PlatformAdapter } from "../platform.js";
import {
  buildProjectSnapshot,
  walkProjectScopes,
} from "./discovery/index.js";
import { resolveEffectiveConfiguration } from "./resolution/resolver.js";
import { detectCursorVersion } from "./version/index.js";

export const ADAPTER_ID = "cursor" as const;

export async function scanProject(options: AdapterScanOptions): Promise<ProjectSnapshot> {
  const projectPath = path.resolve(options.projectPath);
  const [version, walk] = await Promise.all([
    detectCursorVersion(),
    walkProjectScopes(projectPath),
  ]);

  return buildProjectSnapshot({
    projectPath,
    version,
    walk,
  });
}

export async function resolveProject(
  snapshot: ProjectSnapshot,
  agentId: string,
  context: ExecutionContext,
): Promise<EffectiveConfiguration> {
  return resolveEffectiveConfiguration(snapshot, agentId, context);
}

export const cursorAdapter: PlatformAdapter = {
  id: ADAPTER_ID,
  scan: async (options) => ({
    snapshot: await scanProject(options),
    status: "complete",
  }),
  resolve: resolveProject,
};
