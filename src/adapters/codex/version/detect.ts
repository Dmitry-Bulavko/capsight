import type { PlatformVersion } from "../../../core/model/index.js";
import {
  defaultCommandRunner,
  detectCliVersion,
  type CommandRunner,
  type DetectCliVersionOptions as BaseDetectOptions,
} from "../../shared/cli-version-detect.js";
import { CODEX_PLATFORM } from "../model/index.js";

const CODEX_VERSION_COMMAND = "codex --version";

export type { CommandRunner };
export { defaultCommandRunner };

export interface DetectCodexVersionOptions {
  commandRunner?: CommandRunner;
  timeoutMs?: number;
}

/** @see docs/CODEX-FACTS.md XV1–XV3 */
export async function detectCodexVersion(
  options: DetectCodexVersionOptions = {},
): Promise<PlatformVersion> {
  const detectOptions: BaseDetectOptions = {
    platform: CODEX_PLATFORM,
    command: CODEX_VERSION_COMMAND,
    ...options,
  };
  return detectCliVersion(detectOptions);
}
