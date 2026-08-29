import type { PlatformId } from "../adapters/platform.js";
import type { ProjectSnapshot } from "../core/model/index.js";

export class UnsupportedPlatformError extends Error {
  readonly platform: PlatformId;

  constructor(platform: PlatformId, feature: string) {
    super(`${feature} is not supported for platform "${platform}" yet`);
    this.name = "UnsupportedPlatformError";
    this.platform = platform;
  }
}

export function assertClaudePlatform(snapshot: ProjectSnapshot, feature: string): void {
  const platform = snapshot.version.platform;
  if (platform !== "claude") {
    throw new UnsupportedPlatformError(platform as PlatformId, feature);
  }
}
