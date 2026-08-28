import fs from "node:fs/promises";
import type { PlatformEnvironment } from "../../../core/model/index.js";
import type { SettingsLayer } from "../discovery/types.js";

/** @see docs/SPEC.md §3.11 — known resolution-affecting process env keys */
const KNOWN_CLAUDE_ENV_EFFECTS: Readonly<Record<string, string>> = {
  CLAUDE_CODE_DISABLE_BACKGROUND_TASKS:
    "All subagents run in foreground; only Filter 1 applies",
  CLAUDE_CODE_FORK_SUBAGENT:
    "Controls fork mode (1 enables in non-interactive/SDK, 0 disables everywhere)",
  CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH:
    "Sets subagent nesting limit; affects Agent tool availability",
  CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS: "Removes Explore and Plan built-in agents",
  CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS: "Removes all built-in agent types",
  CLAUDE_CODE_SUBAGENT_MODEL:
    "Overrides subagent model (inherit treated as unset)",
  CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS: "Sets parallel subagent limit",
  CLAUDE_CODE_DISABLE_AUTO_MEMORY: "Disables memory in frontmatter",
};

const SETTINGS_ENV_EFFECT =
  "Injected into every session and tool invocation";

export interface BuildPlatformEnvironmentInput {
  /** Process environment; defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
  settingsLayers: SettingsLayer[];
}

/**
 * Build platform environment metadata from process env and settings layers.
 * Never includes secret values — key names and normalized effects only.
 * @see docs/SPEC.md §3.11, §5 PlatformEnvironment
 */
export async function buildPlatformEnvironment(
  input: BuildPlatformEnvironmentInput,
): Promise<PlatformEnvironment> {
  const env = input.env ?? process.env;
  const relevant: PlatformEnvironment["relevant"] = [];

  for (const [key, effect] of Object.entries(KNOWN_CLAUDE_ENV_EFFECTS)) {
    if (env[key] !== undefined) {
      relevant.push({
        key,
        origin: "process",
        effect,
      });
    }
  }

  const seenSettingsKeys = new Set<string>();
  const sortedLayers = [...input.settingsLayers].sort(
    (a, b) => b.priority - a.priority,
  );

  for (const layer of sortedLayers) {
    const keys = await readSettingsEnvKeys(layer.path);
    for (const key of keys) {
      if (seenSettingsKeys.has(key)) {
        continue;
      }
      seenSettingsKeys.add(key);
      relevant.push({
        key,
        origin: "settings.env",
        effect: SETTINGS_ENV_EFFECT,
      });
    }
  }

  return { relevant };
}

async function readSettingsEnvKeys(settingsPath: string): Promise<string[]> {
  try {
    const raw = await fs.readFile(settingsPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return [];
    }
    const envBlock = (parsed as Record<string, unknown>).env;
    if (
      typeof envBlock !== "object" ||
      envBlock === null ||
      Array.isArray(envBlock)
    ) {
      return [];
    }
    return Object.keys(envBlock as Record<string, unknown>).sort();
  } catch {
    return [];
  }
}
