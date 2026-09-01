import type { PlatformEnvironment } from "../../core/model/index.js";

/** Platforms with no documented process-env resolution keys. */
export async function buildEmptyPlatformEnvironment(): Promise<PlatformEnvironment> {
  return { relevant: [] };
}
