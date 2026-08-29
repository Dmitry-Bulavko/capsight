import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/** Resolve CODEX_HOME (default ~/.codex). */
export function codexHomeDir(env: NodeJS.ProcessEnv = process.env): string {
  const home = env.CODEX_HOME?.trim();
  if (home) {
    return path.resolve(home);
  }
  return path.join(os.homedir(), ".codex");
}

export function userConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(codexHomeDir(env), "config.toml");
}

export function systemConfigPath(): string | undefined {
  if (process.platform === "win32") {
    return undefined;
  }
  return "/etc/codex/config.toml";
}

export async function readConfigFile(configPath: string): Promise<string | null> {
  try {
    return await fs.readFile(configPath, "utf8");
  } catch {
    return null;
  }
}
