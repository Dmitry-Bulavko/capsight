import { PLATFORM_IDS, type PlatformId } from "../adapters/platform.js";
import type { ResourceCompatVerdicts } from "../server/routes/ecosystem.js";

export function graphAgentCompat(platform: string): ResourceCompatVerdicts {
  const compat: ResourceCompatVerdicts = {};
  for (const id of PLATFORM_IDS) {
    compat[id] = {
      support: id === platform ? "supported" : "unknown",
      enforcement: "unknown",
    };
  }
  return compat;
}

export function graphAgentPlatform(platform: string | undefined): PlatformId {
  if (platform === "claude" || platform === "cursor" || platform === "codex") {
    return platform;
  }
  return "claude";
}
