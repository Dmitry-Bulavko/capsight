import type { GraphNodeKind } from "../core/graph/build-graph.js";
import { ecosystemKindGlow } from "./ecosystem-block-kinds.js";

export const GRAPH_NODE_KIND_META: Record<
  GraphNodeKind,
  { label: string; color: string; hint: string }
> = {
  agent: {
    label: "Agent",
    color: "#8ab4f8",
    hint: "Agent definition in the inspection graph.",
  },
  tool: {
    label: "Tool",
    color: "#81c995",
    hint: "Built-in or configured tool available to the agent.",
  },
  mcp_server: {
    label: "MCP Server",
    color: "#f28b82",
    hint: "MCP server connected to the agent.",
  },
  mcp_tool: {
    label: "MCP Tool",
    color: "#fdd663",
    hint: "Tool exposed by an MCP server.",
  },
  skill: {
    label: "Skill",
    color: "#c58af9",
    hint: "Skill with instructions and optional tool allowances.",
  },
  instruction: {
    label: "Instruction",
    color: "#78d9ec",
    hint: "Instruction source applied to the agent.",
  },
};

export function graphNodeKindColor(kind: GraphNodeKind): string {
  return GRAPH_NODE_KIND_META[kind].color;
}

export function formatGraphNodeKind(kind: GraphNodeKind): string {
  return GRAPH_NODE_KIND_META[kind].label;
}

export function graphNodeKindHint(kind: GraphNodeKind): string {
  return GRAPH_NODE_KIND_META[kind].hint;
}

export function graphNodeKindGlow(kind: GraphNodeKind): string {
  return ecosystemKindGlow(graphNodeKindColor(kind));
}

export const NODE_KIND_COLORS: Record<GraphNodeKind, string> = Object.fromEntries(
  Object.entries(GRAPH_NODE_KIND_META).map(([kind, meta]) => [kind, meta.color]),
) as Record<GraphNodeKind, string>;
