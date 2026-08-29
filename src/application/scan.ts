import path from "node:path";
import type { ProjectSnapshot } from "../core/model/index.js";
import { detectClaudeVersion } from "../adapters/claude/version/index.js";
import {
  buildProjectSnapshot,
  walkProjectScopes,
} from "../adapters/claude/discovery/index.js";

export interface ScanOptions {
  projectPath: string;
  addDirs?: string[];
  /**
   * Directories of installed plugins whose `agents/` are attached at the
   * lowest priority (A1). SPEC §3 establishes no install location, so the
   * caller names the roots rather than the scan guessing them.
   */
  pluginRoots?: string[];
}

export interface ScanResult {
  snapshot: ProjectSnapshot;
  status: "complete";
}

export async function scan(options: ScanOptions): Promise<ScanResult> {
  const projectPath = path.resolve(options.projectPath);
  const [version, walk] = await Promise.all([
    detectClaudeVersion(),
    walkProjectScopes(projectPath),
  ]);

  const snapshot = await buildProjectSnapshot({
    projectPath,
    version,
    walk,
    addDirs: options.addDirs,
    pluginRoots: options.pluginRoots,
  });

  return {
    snapshot,
    status: "complete",
  };
}
