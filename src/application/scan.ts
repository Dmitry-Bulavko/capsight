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
  });

  return {
    snapshot,
    status: "complete",
  };
}
