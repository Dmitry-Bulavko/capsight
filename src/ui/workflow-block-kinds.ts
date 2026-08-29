/** Workflow Lab block kinds — superset of inspection graph node kinds. */
export type WorkflowBlockKind =
  | "agent"
  | "tool"
  | "mcp_server"
  | "mcp_tool"
  | "skill"
  | "instruction"
  | "markdown_file"
  | "code_file";

export interface WorkflowBlockKindMeta {
  label: string;
  hint: string;
  color: string;
}

export const WORKFLOW_BLOCK_KIND_META: Record<WorkflowBlockKind, WorkflowBlockKindMeta> = {
  agent: {
    label: "Agent",
    hint: "Agent definition — spawns or runs as a subagent with its own tool pool.",
    color: "#8ab4f8",
  },
  tool: {
    label: "Tool",
    hint: "Builtin tool — a platform tool available to the agent in this context.",
    color: "#81c995",
  },
  mcp_server: {
    label: "MCP Server",
    hint: "MCP server — external tool provider configured in project settings.",
    color: "#f28b82",
  },
  mcp_tool: {
    label: "MCP Tool",
    hint: "MCP tool — a specific capability exposed by an MCP server.",
    color: "#fdd663",
  },
  skill: {
    label: "Skill",
    hint: "Skill — preloaded instructions and optional tool allowances.",
    color: "#c58af9",
  },
  instruction: {
    label: "Instruction",
    hint: "Instruction source — CLAUDE.md or other context injected into the agent.",
    color: "#78d9ec",
  },
  markdown_file: {
    label: "Markdown file",
    hint: "Markdown document — agent definition, skill, plan, or project docs (.md).",
    color: "#9ecbff",
  },
  code_file: {
    label: "Code file",
    hint: "Source file — hook script, adapter, or executable project code.",
    color: "#6dd4c6",
  },
};

export const WORKFLOW_BLOCK_KINDS: WorkflowBlockKind[] = [
  "agent",
  "tool",
  "mcp_server",
  "mcp_tool",
  "skill",
  "instruction",
  "markdown_file",
  "code_file",
];

export function workflowBlockKindColor(kind: WorkflowBlockKind): string {
  return WORKFLOW_BLOCK_KIND_META[kind].color;
}

export function formatWorkflowBlockKind(kind: WorkflowBlockKind): string {
  return WORKFLOW_BLOCK_KIND_META[kind].label;
}

export type WorkflowLabEdgeKind =
  | "agent-tool"
  | "agent-mcp-server"
  | "mcp-server-mcp-tool"
  | "agent-skill"
  | "agent-instruction"
  | "agent-agent"
  | "agent-markdown-file"
  | "agent-code-file";

export const WORKFLOW_EDGE_LEGEND: Array<{ kind: WorkflowLabEdgeKind; label: string }> = [
  { kind: "agent-tool", label: "agent → tool" },
  { kind: "agent-mcp-server", label: "agent → MCP server" },
  { kind: "mcp-server-mcp-tool", label: "MCP server → tool" },
  { kind: "agent-skill", label: "agent → skill" },
  { kind: "agent-instruction", label: "agent → instruction" },
  { kind: "agent-agent", label: "agent → agent" },
  { kind: "agent-markdown-file", label: "agent → markdown file" },
  { kind: "agent-code-file", label: "agent → code file" },
];

const WORKFLOW_EDGE_COLORS: Record<WorkflowLabEdgeKind, string> = {
  "agent-tool": "#6b9e78",
  "agent-mcp-server": "#c8716a",
  "mcp-server-mcp-tool": "#c9a832",
  "agent-skill": "#a56fd4",
  "agent-instruction": "#5eb8cc",
  "agent-agent": "#8ab4f8",
  "agent-markdown-file": "#7aa2d4",
  "agent-code-file": "#4fb8a8",
};

export function workflowEdgeColor(kind: WorkflowLabEdgeKind): string {
  return WORKFLOW_EDGE_COLORS[kind];
}

export function workflowEdgeLabel(kind: WorkflowLabEdgeKind): string {
  return WORKFLOW_EDGE_LEGEND.find((item) => item.kind === kind)?.label ?? kind;
}

/** Short canvas label — matches reference mock (uses, imports, mcp, …). */
export function workflowEdgeShortLabel(
  kind: WorkflowLabEdgeKind,
  options?: { reverse?: boolean },
): string {
  switch (kind) {
    case "agent-agent":
      return "spawn";
    case "agent-skill":
      return "uses";
    case "agent-tool":
    case "agent-instruction":
      return "uses";
    case "agent-mcp-server":
    case "mcp-server-mcp-tool":
      return "mcp";
    case "agent-code-file":
      return "imports";
    case "agent-markdown-file":
      return options?.reverse ? "references" : "uses";
    default:
      return workflowEdgeLabel(kind);
  }
}
