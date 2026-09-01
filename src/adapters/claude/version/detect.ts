import type { PlatformVersion } from "../../../core/model/index.js";
import {
  defaultCommandRunner,
  detectCliVersion,
  type CommandRunner,
  type DetectCliVersionOptions as BaseDetectOptions,
} from "../../shared/cli-version-detect.js";

const CLAUDE_VERSION_COMMAND = "claude --version";

export type { CommandRunner };
export { defaultCommandRunner };

export interface DetectClaudeVersionOptions {
  commandRunner?: CommandRunner;
  timeoutMs?: number;
}

export async function detectClaudeVersion(
  options: DetectClaudeVersionOptions = {},
): Promise<PlatformVersion> {
  const detectOptions: BaseDetectOptions = {
    platform: "claude",
    command: CLAUDE_VERSION_COMMAND,
    ...options,
  };
  return detectCliVersion(detectOptions);
}
