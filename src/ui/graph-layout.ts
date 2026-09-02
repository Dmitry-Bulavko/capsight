import { Position, type Edge, type Node } from "@xyflow/react";
import type { GraphEdgeKind, GraphNodeKind, InspectionGraph } from "../core/graph/build-graph.js";
import { NODE_KIND_COLORS } from "./graph-node-kinds.js";

export { NODE_KIND_COLORS };

const KIND_ORDER: GraphNodeKind[] = [
  "agent",
  "tool",
  "mcp_server",
  "mcp_tool",
  "skill",
  "instruction",
];

const CAPABILITY_NODE_WIDTH = 172;
const CAPABILITY_NODE_HEIGHT = 68;
const AGENT_NODE_WIDTH = 172;
const AGENT_NODE_HEIGHT = 150;
const GRID_GAP_X = 28;
const GRID_GAP_Y = 14;
const LANE_GAP = 96;

function nodeDimensions(kind: GraphNodeKind): { width: number; height: number } {
  if (kind === "agent") {
    return { width: AGENT_NODE_WIDTH, height: AGENT_NODE_HEIGHT };
  }
  return { width: CAPABILITY_NODE_WIDTH, height: CAPABILITY_NODE_HEIGHT };
}

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

function laneSize(nodeCount: number, kind: GraphNodeKind): { width: number; height: number; columns: number } {
  const { width: nodeWidth, height: nodeHeight } = nodeDimensions(kind);
  const columns = gridColumns(nodeCount);
  const rows = Math.ceil(nodeCount / columns);
  return {
    columns,
    width: columns * nodeWidth + Math.max(0, columns - 1) * GRID_GAP_X,
    height: rows * nodeHeight + Math.max(0, rows - 1) * GRID_GAP_Y,
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
    return { kind, count, ...laneSize(count, kind) };
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
      const { width, height } = nodeDimensions(node.kind);

      positionedNodes.push({
        id: node.id,
        position: {
          x: laneX + col * (width + GRID_GAP_X),
          y: laneYOffset + row * (height + GRID_GAP_Y),
        },
        data: {
          label: node.label,
          kind: node.kind,
          ...(node.kind === "agent"
            ? { platform: node.platform, scope: node.scope }
            : {}),
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
          width,
          height,
          padding: 0,
          background: "transparent",
          border: "none",
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
