import type { PlatformVersion } from "../../../core/model/index.js";
import {
  defaultCommandRunner,
  detectCliVersion,
  type CommandRunner,
  type DetectCliVersionOptions as BaseDetectOptions,
} from "../../shared/cli-version-detect.js";
import { CURSOR_PLATFORM } from "../model/index.js";

const CURSOR_VERSION_COMMAND = "cursor --version";

export type { CommandRunner };
export { defaultCommandRunner };

export interface DetectCursorVersionOptions {
  commandRunner?: CommandRunner;
  timeoutMs?: number;
}

/** @see docs/CURSOR-FACTS.md CV1–CV3 */
export async function detectCursorVersion(
  options: DetectCursorVersionOptions = {},
): Promise<PlatformVersion> {
  const detectOptions: BaseDetectOptions = {
    platform: CURSOR_PLATFORM,
    command: CURSOR_VERSION_COMMAND,
    ...options,
  };
  return detectCliVersion(detectOptions);
}
