import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { Scope } from "../../../core/model/index.js";
import type { ProjectScopeLevel } from "./project-walk.js";
import type { SettingsLayer } from "./types.js";

const SETTINGS_PRIORITY: Record<string, { scope: Scope; priority: number }> = {
  "settings.local.json": { scope: "local", priority: 35 },
  "settings.json": { scope: "project", priority: 30 },
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function discoverSettingsLayers(
  projectScopes: ProjectScopeLevel[],
): Promise<SettingsLayer[]> {
  const layers: SettingsLayer[] = [];

  for (const scope of projectScopes) {
    if (!scope.hasClaudeDir) {
      continue;
    }
    const claudeDir = path.join(scope.path, ".claude");
    for (const [fileName, meta] of Object.entries(SETTINGS_PRIORITY)) {
      const filePath = path.join(claudeDir, fileName);
      if (await fileExists(filePath)) {
        layers.push({
          scope: meta.scope,
          path: filePath,
          priority: meta.priority,
        });
      }
    }
  }

  const userSettings = path.join(os.homedir(), ".claude", "settings.json");
  if (await fileExists(userSettings)) {
    layers.push({ scope: "user", path: userSettings, priority: 20 });
  }

  return layers.sort((a, b) => b.priority - a.priority);
}
