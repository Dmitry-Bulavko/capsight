import type { PlatformEnvironment } from "../../../core/model/index.js";
import type { SettingsLayer } from "../discovery/types.js";

export interface BuildPlatformEnvironmentInput {
  env?: NodeJS.ProcessEnv;
  settingsLayers: SettingsLayer[];
}

/** Codex v1: no documented process-env resolution keys; settings layers recorded only. */
export async function buildPlatformEnvironment(
  _input: BuildPlatformEnvironmentInput,
): Promise<PlatformEnvironment> {
  return { relevant: [] };
}
