/**
 * Claude builtin tool tables, supplied to the core engine as data.
 * @see docs/SPEC.md T1, T2, T4, F11, §3.2
 */
import type { PlatformToolTables } from "../../../core/resolver/tool-tables.js";

/** Tools removed from all subagents by Filter 1 (T1). Depth limit handled separately (N2). */
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

/** Kept by Filter 1 when the subagent runs in plan mode (T1). */
export const FILTER_1_PLAN_MODE_EXEMPT_TOOLS = ["ExitPlanMode"] as const;

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

/** Additionally kept for teammates in agent teams (T4). */
export const TEAMMATE_ADDITIONAL_TOOLS = [
  "TaskCreate",
  "TaskGet",
  "TaskList",
  "TaskUpdate",
  "CronCreate",
  "CronDelete",
  "CronList",
] as const;

/** Agent spawn tool names (F11: Task is legacy alias for Agent). */
export const AGENT_TOOL_NAMES = ["Agent", "Task"] as const;

/** Namespace prefix of MCP-provided tools. */
const MCP_TOOL_PREFIX = "mcp__";

export function isMcpTool(toolName: string): boolean {
  return toolName.startsWith(MCP_TOOL_PREFIX);
}

export function isAgentTool(toolName: string): boolean {
  return (AGENT_TOOL_NAMES as readonly string[]).includes(toolName);
}

/** Server id owning an MCP tool name, or `undefined` when it has none. */
export function mcpToolServerId(toolName: string): string | undefined {
  if (!isMcpTool(toolName)) {
    return undefined;
  }

  const rest = toolName.slice(MCP_TOOL_PREFIX.length);
  const separator = rest.indexOf("__");
  if (separator === -1) {
    return rest.length > 0 ? rest : undefined;
  }

  const serverId = rest.slice(0, separator);
  return serverId.length > 0 ? serverId : undefined;
}

/** Tables handed to the platform-agnostic filter engine and graph builder. */
export const CLAUDE_TOOL_TABLES: PlatformToolTables = {
  agentToolNames: AGENT_TOOL_NAMES,
  filter1RemovedTools: FILTER_1_REMOVED_TOOLS,
  filter1PlanModeExemptTools: FILTER_1_PLAN_MODE_EXEMPT_TOOLS,
  planModeBuiltinKind: "plan",
  filter2AllowedBuiltinTools: BACKGROUND_ALLOWED_BUILTIN_TOOLS,
  filter2TeammateAdditionalTools: TEAMMATE_ADDITIONAL_TOOLS,
  isNamespacedTool: isMcpTool,
  namespacedToolOwner: mcpToolServerId,
};
