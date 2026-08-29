import type { ContextPreset, ExecutionContext } from "../model/index.js";

export interface ExecutionContextOverrides {
  depth?: number;
  maxDepth?: number;
  /** Platform-defined parent permission mode identifier. */
  parentPermissionMode?: string;
}

/** Platform-supplied defaults; the adapter owns their interpretation (§4.3). */
export interface ExecutionContextDefaults {
  maxDepth: number;
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

/**
 * Build ExecutionContext from preset, platform defaults and optional overrides.
 * @see docs/SPEC.md §4.2–§4.3
 */
export function buildExecutionContext(
  preset: ContextPreset,
  defaults: ExecutionContextDefaults,
  overrides: ExecutionContextOverrides = {},
): ExecutionContext {
  const flags = PRESET_FLAGS[preset];
  return {
    preset,
    ...flags,
    depth: overrides.depth ?? 0,
    maxDepth: overrides.maxDepth ?? defaults.maxDepth,
    ...(overrides.parentPermissionMode !== undefined
      ? { parentPermissionMode: overrides.parentPermissionMode }
      : {}),
  };
}
