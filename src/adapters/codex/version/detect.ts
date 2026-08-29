import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { PlatformVersion } from "../../../core/model/index.js";
import { CODEX_PLATFORM } from "../model/index.js";

const execAsync = promisify(exec);

const CODEX_VERSION_COMMAND = "codex --version";
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

export interface DetectCodexVersionOptions {
  commandRunner?: CommandRunner;
  timeoutMs?: number;
}

function parseSemver(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/(\d+\.\d+\.\d+(?:-[\w.]+)?)/);
  return match?.[1] ?? null;
}

function degradedVersion(raw: string): PlatformVersion {
  return {
    platform: CODEX_PLATFORM,
    version: "unknown",
    raw,
    detectedAt: new Date().toISOString(),
  };
}

function detectedVersion(version: string, raw: string): PlatformVersion {
  return {
    platform: CODEX_PLATFORM,
    version,
    raw,
    detectedAt: new Date().toISOString(),
  };
}

/** @see docs/CODEX-FACTS.md XV1–XV3 */
export async function detectCodexVersion(
  options: DetectCodexVersionOptions = {},
): Promise<PlatformVersion> {
  const runner = options.commandRunner ?? defaultCommandRunner;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const { stdout, stderr } = await runner.run(CODEX_VERSION_COMMAND, timeoutMs);
    const raw = stdout.trim() || stderr.trim();

    if (!raw) {
      return degradedVersion("");
    }

    const version = parseSemver(raw);
    if (!version) {
      return degradedVersion(raw);
    }

    return detectedVersion(version, raw);
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    return degradedVersion(raw);
  }
}
