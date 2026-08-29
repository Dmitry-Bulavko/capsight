import path from "node:path";
import type { Scope, TrustState } from "../../../core/model/index.js";
import { parseToml } from "../parsing/toml.js";
import { readConfigFile, systemConfigPath, userConfigPath } from "./paths.js";
import type { WalkProjectScopesResult } from "./project-walk.js";
import { scopesRootToCwd } from "./project-walk.js";
import { shouldSkipProjectCodexLayers } from "./trust.js";
import type { SettingsLayer } from "./types.js";

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const { access } = await import("node:fs/promises");
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** @see docs/CODEX-FACTS.md §3, XSet1 */
export async function discoverSettingsLayers(
  walk: WalkProjectScopesResult,
  trust: TrustState,
): Promise<SettingsLayer[]> {
  const layers: SettingsLayer[] = [];
  const skipProjectCodex = shouldSkipProjectCodexLayers(trust);

  const systemPath = systemConfigPath();
  if (systemPath && (await fileExists(systemPath))) {
    layers.push({ scope: "managed" as Scope, path: systemPath, priority: 10 });
  }

  const userPath = userConfigPath();
  if (await fileExists(userPath)) {
    layers.push({ scope: "user" as Scope, path: userPath, priority: 40 });
  }

  if (!skipProjectCodex) {
    let priority = 50;
    for (const scope of scopesRootToCwd(walk)) {
      if (!scope.codexConfigPath) {
        continue;
      }
      const scopeType: Scope =
        path.resolve(scope.path) === path.resolve(walk.projectPath)
          ? "project"
          : "nested-project";
      layers.push({
        scope: scopeType,
        path: scope.codexConfigPath,
        priority,
      });
      priority += 1;
    }
  }

  return layers.sort((left, right) => right.priority - left.priority);
}

export async function readMergedConfigKeys(
  walk: WalkProjectScopesResult,
  trust: TrustState,
): Promise<Set<string>> {
  const keys = new Set<string>();
  const layers = await discoverSettingsLayers(walk, trust);

  for (const layer of [...layers].reverse()) {
    const raw = await readConfigFile(layer.path);
    if (!raw) {
      continue;
    }
    const parsed = parseToml(raw);
    for (const key of Object.keys(parsed)) {
      keys.add(key);
    }
  }

  return keys;
}
