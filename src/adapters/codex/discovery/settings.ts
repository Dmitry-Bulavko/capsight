import path from "node:path";
import type { Scope, TrustState, UnknownFieldType } from "../../../core/model/index.js";
import { parseToml } from "../parsing/toml.js";
import { gateCapability, MATRIX } from "../version/matrix.js";
import { KNOWN_TOP_LEVEL_CONFIG_KEYS } from "./config-keys.js";
import { readConfigFile, systemConfigPath, userConfigPath } from "./paths.js";
import type { WalkProjectScopesResult } from "./project-walk.js";
import { scopesRootToCwd } from "./project-walk.js";
import { redactUnknownFields } from "./redact.js";
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

function unknownFieldsForConfig(
  parsed: Record<string, unknown>,
  includeUnknownFields: boolean,
): Record<string, UnknownFieldType> | undefined {
  if (!includeUnknownFields) {
    return undefined;
  }
  const unknownFields = redactUnknownFields(parsed, KNOWN_TOP_LEVEL_CONFIG_KEYS);
  return Object.keys(unknownFields).length > 0 ? unknownFields : undefined;
}

async function pushConfigLayer(
  layers: SettingsLayer[],
  configPath: string,
  scope: Scope,
  priority: number,
  includeUnknownFields: boolean,
): Promise<void> {
  const raw = await readConfigFile(configPath);
  if (!raw) {
    layers.push({ scope, path: configPath, priority });
    return;
  }

  const parsed = parseToml(raw) as Record<string, unknown>;
  const unknownFields = unknownFieldsForConfig(parsed, includeUnknownFields);
  layers.push({
    scope,
    path: configPath,
    priority,
    ...(unknownFields ? { unknownFields } : {}),
  });
}

/** @see docs/CODEX-FACTS.md §3, XSet1 */
export async function discoverSettingsLayers(
  walk: WalkProjectScopesResult,
  trust: TrustState,
  version: string,
): Promise<SettingsLayer[]> {
  const layers: SettingsLayer[] = [];
  const skipProjectCodex = shouldSkipProjectCodexLayers(trust);
  const knownKeysGate = gateCapability(MATRIX["settings.knownKeysOnly"], version);
  const includeUnknownFields = !knownKeysGate.unfounded;

  const systemPath = systemConfigPath();
  if (systemPath && (await fileExists(systemPath))) {
    await pushConfigLayer(layers, systemPath, "managed" as Scope, 10, includeUnknownFields);
  }

  const userPath = userConfigPath();
  if (await fileExists(userPath)) {
    await pushConfigLayer(layers, userPath, "user" as Scope, 40, includeUnknownFields);
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
      await pushConfigLayer(
        layers,
        scope.codexConfigPath,
        scopeType,
        priority,
        includeUnknownFields,
      );
      priority += 1;
    }
  }

  return layers.sort((left, right) => right.priority - left.priority);
}

export async function readMergedConfigKeys(
  walk: WalkProjectScopesResult,
  trust: TrustState,
  version: string,
): Promise<Set<string>> {
  const keys = new Set<string>();
  const layers = await discoverSettingsLayers(walk, trust, version);

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
