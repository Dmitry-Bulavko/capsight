import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Scope } from "../../../core/model/index.js";
import type { SettingsLayer } from "./types.js";

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function cursorUserSettingsPath(): string | undefined {
  const home = os.homedir();
  switch (process.platform) {
    case "win32":
      return path.join(home, "AppData", "Roaming", "Cursor", "User", "settings.json");
    case "darwin":
      return path.join(home, "Library", "Application Support", "Cursor", "User", "settings.json");
    default:
      return path.join(home, ".config", "Cursor", "User", "settings.json");
  }
}

/** @see docs/CURSOR-FACTS.md CSet1–CSet3 */
export async function discoverSettingsLayers(): Promise<SettingsLayer[]> {
  const layers: SettingsLayer[] = [];
  const userSettings = cursorUserSettingsPath();

  if (userSettings && (await fileExists(userSettings))) {
    layers.push({
      scope: "user" as Scope,
      path: userSettings,
      priority: 20,
    });
  }

  return layers.sort((a, b) => b.priority - a.priority);
}
