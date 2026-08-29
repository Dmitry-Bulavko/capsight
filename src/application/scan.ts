import {
  DEFAULT_PLATFORM_ID,
  getAdapter,
  type PlatformId,
} from "../adapters/registry.js";
import type { ProjectSnapshot } from "../core/model/index.js";

export type { PlatformId } from "../adapters/platform.js";

export interface ScanOptions {
  projectPath: string;
  platform?: PlatformId;
  addDirs?: string[];
  /**
   * Directories of installed plugins whose `agents/` are attached at the
   * lowest priority (A1). SPEC §3 establishes no install location, so the
   * caller names the roots rather than the scan guessing them.
   */
  pluginRoots?: string[];
}

export interface ScanResult {
  platform: PlatformId;
  snapshot: ProjectSnapshot;
  status: "complete";
}

export async function scan(options: ScanOptions): Promise<ScanResult> {
  const platform = options.platform ?? DEFAULT_PLATFORM_ID;
  const adapter = getAdapter(platform);
  const result = await adapter.scan({
    projectPath: options.projectPath,
    addDirs: options.addDirs,
    pluginRoots: options.pluginRoots,
  });

  return {
    platform,
    ...result,
  };
}
