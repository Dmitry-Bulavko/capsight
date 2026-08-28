/**
 * Subagent spawn depth default and its environment override.
 * @see docs/SPEC.md §3.11, §4.3, N5
 */

/** Default subagent nesting limit when the environment says nothing (N5). */
export const DEFAULT_MAX_SUBAGENT_SPAWN_DEPTH = 3;

/** @see docs/SPEC.md §4.3 — CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH or the default */
export function getDefaultMaxDepth(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH;
  if (raw === undefined || raw === "") {
    return DEFAULT_MAX_SUBAGENT_SPAWN_DEPTH;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? DEFAULT_MAX_SUBAGENT_SPAWN_DEPTH : parsed;
}
