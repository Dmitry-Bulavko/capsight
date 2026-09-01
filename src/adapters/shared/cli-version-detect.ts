import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { PlatformVersion } from "../../core/model/index.js";
import type { PlatformId } from "../platform.js";
import { extractSemverString } from "../../core/version/semver.js";

const execAsync = promisify(exec);

const DEFAULT_TIMEOUT_MS = 5000;

export interface CommandRunner {
  run(command: string, timeoutMs: number): Promise<{ stdout: string; stderr: string }>;
}

export const defaultCommandRunner: CommandRunner = {
  async run(command, timeoutMs) {
    const { stdout, stderr } = await execAsync(command, {
      timeout: timeoutMs,
      encoding: "utf8",
    });
    return { stdout, stderr };
  },
};

export interface DetectCliVersionOptions {
  platform: PlatformId;
  command: string;
  commandRunner?: CommandRunner;
  timeoutMs?: number;
}

function degradedVersion(platform: PlatformId, raw: string): PlatformVersion {
  return {
    platform,
    version: "unknown",
    raw,
    detectedAt: new Date().toISOString(),
  };
}

function detectedVersion(platform: PlatformId, version: string, raw: string): PlatformVersion {
  return {
    platform,
    version,
    raw,
    detectedAt: new Date().toISOString(),
  };
}

export async function detectCliVersion(
  options: DetectCliVersionOptions,
): Promise<PlatformVersion> {
  const runner = options.commandRunner ?? defaultCommandRunner;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const { stdout, stderr } = await runner.run(options.command, timeoutMs);
    const raw = stdout.trim() || stderr.trim();

    if (!raw) {
      return degradedVersion(options.platform, "");
    }

    const version = extractSemverString(raw);
    if (!version) {
      return degradedVersion(options.platform, raw);
    }

    return detectedVersion(options.platform, version, raw);
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    return degradedVersion(options.platform, raw);
  }
}
