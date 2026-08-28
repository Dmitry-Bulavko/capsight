import { Position, type Edge, type Node } from "@xyflow/react";
import type { GraphEdgeKind, GraphNodeKind, InspectionGraph } from "../core/graph/build-graph.js";

const KIND_ORDER: GraphNodeKind[] = [
  "agent",
  "tool",
  "mcp_server",
  "mcp_tool",
  "skill",
  "instruction",
];

const NODE_WIDTH = 168;
const NODE_HEIGHT = 56;
const GRID_GAP_X = 28;
const GRID_GAP_Y = 14;
const LANE_GAP = 96;

export const NODE_KIND_COLORS: Record<GraphNodeKind, string> = {
  agent: "#8ab4f8",
  tool: "#81c995",
  mcp_server: "#f28b82",
  mcp_tool: "#fdd663",
  skill: "#c58af9",
  instruction: "#78d9ec",
};

const EDGE_COLORS: Record<GraphEdgeKind, string> = {
  "agent-tool": "#6b9e78",
  "agent-mcp-server": "#c8716a",
  "mcp-server-mcp-tool": "#c9a832",
  "agent-skill": "#a56fd4",
  "agent-instruction": "#5eb8cc",
  "agent-agent": "#8ab4f8",
};

const EDGE_LABELS: Record<GraphEdgeKind, string> = {
  "agent-tool": "agent → tool",
  "agent-mcp-server": "agent → MCP server",
  "mcp-server-mcp-tool": "MCP server → tool",
  "agent-skill": "agent → skill",
  "agent-instruction": "agent → instruction",
  "agent-agent": "agent → agent",
};

/** Edge kinds shown in the legend when their labels are hidden on the canvas. */
export const GRAPH_LEGEND_ITEMS: Array<{ kind: GraphEdgeKind; label: string }> = [
  { kind: "agent-tool", label: EDGE_LABELS["agent-tool"] },
  { kind: "agent-mcp-server", label: EDGE_LABELS["agent-mcp-server"] },
  { kind: "mcp-server-mcp-tool", label: EDGE_LABELS["mcp-server-mcp-tool"] },
  { kind: "agent-skill", label: EDGE_LABELS["agent-skill"] },
  { kind: "agent-instruction", label: EDGE_LABELS["agent-instruction"] },
  { kind: "agent-agent", label: EDGE_LABELS["agent-agent"] },
];

function gridColumns(count: number): number {
  if (count <= 1) return 1;
  if (count <= 6) return 2;
  if (count <= 15) return 3;
  return 4;
}

function laneSize(nodeCount: number): { width: number; height: number; columns: number } {
  const columns = gridColumns(nodeCount);
  const rows = Math.ceil(nodeCount / columns);
  return {
    columns,
    width: columns * NODE_WIDTH + Math.max(0, columns - 1) * GRID_GAP_X,
    height: rows * NODE_HEIGHT + Math.max(0, rows - 1) * GRID_GAP_Y,
  };
}

function shouldHideEdgeLabels(graph: InspectionGraph): boolean {
  const agentToolCount = graph.edges.filter((edge) => edge.kind === "agent-tool").length;
  return agentToolCount > 2;
}

export function layoutInspectionGraph(graph: InspectionGraph): { nodes: Node[]; edges: Edge[] } {
  const nodesByKind = new Map<GraphNodeKind, InspectionGraph["nodes"]>();

  for (const kind of KIND_ORDER) {
    nodesByKind.set(kind, []);
  }

  for (const node of graph.nodes) {
    nodesByKind.get(node.kind)?.push(node);
  }

  const activeKinds = KIND_ORDER.filter((kind) => (nodesByKind.get(kind)?.length ?? 0) > 0);
  const laneMetrics = activeKinds.map((kind) => {
    const count = nodesByKind.get(kind)?.length ?? 0;
    return { kind, count, ...laneSize(count) };
  });

  const maxLaneHeight = laneMetrics.reduce((max, lane) => Math.max(max, lane.height), 0);
  const hideEdgeLabels = shouldHideEdgeLabels(graph);

  let laneX = 0;
  const positionedNodes: Node[] = [];

  for (const lane of laneMetrics) {
    const kindNodes = [...(nodesByKind.get(lane.kind) ?? [])].sort((a, b) =>
      a.label.localeCompare(b.label),
    );
    const laneYOffset = (maxLaneHeight - lane.height) / 2;

    kindNodes.forEach((node, index) => {
      const col = index % lane.columns;
      const row = Math.floor(index / lane.columns);

      positionedNodes.push({
        id: node.id,
        position: {
          x: laneX + col * (NODE_WIDTH + GRID_GAP_X),
          y: laneYOffset + row * (NODE_HEIGHT + GRID_GAP_Y),
        },
        data: {
          label: node.label,
          kind: node.kind,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
          borderColor: NODE_KIND_COLORS[node.kind],
          background: "#1a1d24",
          color: "#e8eaed",
          width: NODE_WIDTH,
          fontSize: 12,
        },
      });
    });

    laneX += lane.width + LANE_GAP;
  }

  const edges: Edge[] = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    animated: edge.kind === "agent-agent",
    label: hideEdgeLabels && edge.kind === "agent-tool" ? undefined : edge.kind,
    style: { stroke: EDGE_COLORS[edge.kind], strokeWidth: 1.5 },
    labelStyle: { fill: "#bdc1c6", fontSize: 10 },
    labelBgStyle: { fill: "#1a1d24", fillOpacity: 0.92 },
    labelBgPadding: [4, 6] as [number, number],
    labelBgBorderRadius: 4,
  }));

  return { nodes: positionedNodes, edges };
}

export function edgeLegendLabel(kind: GraphEdgeKind): string {
  return EDGE_LABELS[kind];
}

export function edgeLegendColor(kind: GraphEdgeKind): string {
  return EDGE_COLORS[kind];
}
