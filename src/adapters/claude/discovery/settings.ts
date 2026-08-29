import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { Scope } from "../../../core/model/index.js";
import type { ProjectScopeLevel } from "./project-walk.js";
import type {
  SettingsLayer,
  SettingsPermissionAction,
  SettingsPermissionRule,
  SettingsPermissions,
} from "./types.js";

const SETTINGS_PRIORITY: Record<string, { scope: Scope; priority: number }> = {
  "settings.local.json": { scope: "local", priority: 35 },
  "settings.json": { scope: "project", priority: 30 },
};

/** Rule lists in the order §3.5 names them. */
const PERMISSION_ACTIONS: readonly SettingsPermissionAction[] = [
  "allow",
  "deny",
  "ask",
];

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the `permissions` block of a settings file. Rule text is kept verbatim
 * and never interpreted here: whether a rule is valid is an S3–S8 question the
 * resolver answers, and dropping an unreadable rule at discovery time would
 * make it indistinguishable from a rule that was never written.
 * @see docs/SPEC.md §3.5
 */
export async function readSettingsPermissions(
  filePath: string,
): Promise<SettingsPermissions | undefined> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return undefined;
  }
  return parseSettingsPermissions(parsed);
}

/** Extract the `permissions` block from already-parsed settings JSON. */
export function parseSettingsPermissions(
  parsed: unknown,
): SettingsPermissions | undefined {
  if (typeof parsed !== "object" || parsed === null) {
    return undefined;
  }

  const permissions = (parsed as { permissions?: unknown }).permissions;
  if (typeof permissions !== "object" || permissions === null) {
    return undefined;
  }

  const record = permissions as Record<string, unknown>;
  const rules: SettingsPermissionRule[] = [];
  for (const action of PERMISSION_ACTIONS) {
    const entries = record[action];
    if (!Array.isArray(entries)) {
      continue;
    }
    for (const [index, entry] of entries.entries()) {
      rules.push({ action, index, raw: String(entry) });
    }
  }

  const disableBypass = record.disableBypassPermissionsMode;

  return {
    rules,
    ...(typeof disableBypass === "boolean"
      ? { disableBypassPermissionsMode: disableBypass }
      : {}),
  };
}

export async function discoverSettingsLayers(
  projectScopes: ProjectScopeLevel[],
): Promise<SettingsLayer[]> {
  const layers: SettingsLayer[] = [];

  const addLayer = async (
    scope: Scope,
    filePath: string,
    priority: number,
  ): Promise<void> => {
    const permissions = await readSettingsPermissions(filePath);
    layers.push({
      scope,
      path: filePath,
      priority,
      ...(permissions ? { permissions } : {}),
    });
  };

  for (const scope of projectScopes) {
    if (!scope.hasClaudeDir) {
      continue;
    }
    const claudeDir = path.join(scope.path, ".claude");
    for (const [fileName, meta] of Object.entries(SETTINGS_PRIORITY)) {
      const filePath = path.join(claudeDir, fileName);
      if (await fileExists(filePath)) {
        await addLayer(meta.scope, filePath, meta.priority);
      }
    }
  }

  const userSettings = path.join(os.homedir(), ".claude", "settings.json");
  if (await fileExists(userSettings)) {
    await addLayer("user", userSettings, 20);
  }

  return layers.sort((a, b) => b.priority - a.priority);
}
