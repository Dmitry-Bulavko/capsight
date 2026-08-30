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
  return parseSettingsPermissions(await readSettingsJson(filePath));
}

/** Parsed settings JSON, or `undefined` when the file is missing or unreadable. */
async function readSettingsJson(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Top-level `enableAllProjectMcpServers` (S11). Only a boolean counts: the key
 * absent, or written as something else, leaves the layer with no declaration
 * rather than with a `false`, because §3.5 does not state a default.
 */
export function parseEnableAllProjectMcpServers(
  parsed: unknown,
): boolean | undefined {
  if (typeof parsed !== "object" || parsed === null) {
    return undefined;
  }
  const value = (parsed as { enableAllProjectMcpServers?: unknown })
    .enableAllProjectMcpServers;
  return typeof value === "boolean" ? value : undefined;
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
  // S11: recorded verbatim. How a relative entry resolves, and what a rule in
  // `permissions.allow` / `deny` covers inside such a directory, are questions
  // §3.5 does not answer, so discovery does not rewrite the text.
  const additionalDirectories = record.additionalDirectories;

  return {
    rules,
    ...(typeof disableBypass === "boolean"
      ? { disableBypassPermissionsMode: disableBypass }
      : {}),
    ...(Array.isArray(additionalDirectories)
      ? { additionalDirectories: additionalDirectories.map(String) }
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
    const parsed = await readSettingsJson(filePath);
    const permissions = parseSettingsPermissions(parsed);
    const enableAllProjectMcpServers = parseEnableAllProjectMcpServers(parsed);
    layers.push({
      scope,
      path: filePath,
      priority,
      ...(permissions ? { permissions } : {}),
      ...(enableAllProjectMcpServers !== undefined
        ? { enableAllProjectMcpServers }
        : {}),
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
