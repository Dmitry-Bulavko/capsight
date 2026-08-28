import type {
  ContextPreset,
  ExecutionContext,
  PermissionMode,
} from "../model/index.js";

export interface ExecutionContextOverrides {
  depth?: number;
  maxDepth?: number;
  parentPermissionMode?: PermissionMode;
}

type PresetFlags = Pick<
  ExecutionContext,
  "isMainSession" | "isBackground" | "isFork" | "isTeammate" | "builtinKind"
>;

const PRESET_FLAGS: Record<ContextPreset, PresetFlags> = {
  "main-session": {
    isMainSession: true,
    isBackground: false,
    isFork: false,
    isTeammate: false,
  },
  "foreground-subagent": {
    isMainSession: false,
    isBackground: false,
    isFork: false,
    isTeammate: false,
  },
  "background-subagent": {
    isMainSession: false,
    isBackground: true,
    isFork: false,
    isTeammate: false,
  },
  fork: {
    isMainSession: false,
    isBackground: true,
    isFork: true,
    isTeammate: false,
  },
  explore: {
    isMainSession: false,
    isBackground: false,
    isFork: false,
    isTeammate: false,
    builtinKind: "explore",
  },
  plan: {
    isMainSession: false,
    isBackground: false,
    isFork: false,
    isTeammate: false,
    builtinKind: "plan",
  },
  teammate: {
    isMainSession: false,
    isBackground: false,
    isFork: false,
    isTeammate: true,
  },
};

/** @see docs/SPEC.md §4.3 — default from CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH or 3 */
export function getDefaultMaxDepth(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH;
  if (raw === undefined || raw === "") {
    return 3;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? 3 : parsed;
}

/** Build ExecutionContext from preset and optional overrides. @see docs/SPEC.md §4.2–§4.3 */
export function buildExecutionContext(
  preset: ContextPreset,
  overrides: ExecutionContextOverrides = {},
): ExecutionContext {
  const flags = PRESET_FLAGS[preset];
  return {
    preset,
    ...flags,
    depth: overrides.depth ?? 0,
    maxDepth: overrides.maxDepth ?? getDefaultMaxDepth(),
    ...(overrides.parentPermissionMode !== undefined
      ? { parentPermissionMode: overrides.parentPermissionMode }
      : {}),
  };
}
