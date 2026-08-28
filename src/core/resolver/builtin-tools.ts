/**
 * Known builtin tool names for context filters.
 * @see docs/SPEC.md T1, T2
 */

/** Tools removed from all subagents by Filter 1 (T1). Agent at depth limit handled separately (N2). */
export const FILTER_1_REMOVED_TOOLS = [
  "AskUserQuestion",
  "EndConversation",
  "EnterPlanMode",
  "ExitPlanMode",
  "ScheduleWakeup",
  "TaskOutput",
  "WaitForMcpServers",
  "Workflow",
] as const;

/** Builtin tools allowed for background subagents after Filter 2 (T2). */
export const BACKGROUND_ALLOWED_BUILTIN_TOOLS = [
  "Read",
  "Grep",
  "Glob",
  "Bash",
  "PowerShell",
  "Edit",
  "Write",
  "NotebookEdit",
  "WebFetch",
  "WebSearch",
  "TodoWrite",
  "Skill",
  "ToolSearch",
  "EnterWorktree",
  "ExitWorktree",
  "Monitor",
  "TaskStop",
  "SendMessage",
  "Artifact",
] as const;

/** Agent spawn tool names (F11: Task is legacy alias for Agent). */
export const AGENT_TOOL_NAMES = ["Agent", "Task"] as const;

const BACKGROUND_ALLOWED_SET = new Set<string>(BACKGROUND_ALLOWED_BUILTIN_TOOLS);
const FILTER_1_REMOVED_SET = new Set<string>(FILTER_1_REMOVED_TOOLS);

export function isMcpTool(toolName: string): boolean {
  return toolName.startsWith("mcp__");
}

export function isAgentTool(toolName: string): boolean {
  return (AGENT_TOOL_NAMES as readonly string[]).includes(toolName);
}

export function isFilter1RemovedTool(toolName: string): boolean {
  return FILTER_1_REMOVED_SET.has(toolName);
}

export function isBackgroundAllowedBuiltin(toolName: string): boolean {
  return BACKGROUND_ALLOWED_SET.has(toolName);
}
