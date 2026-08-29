import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { WorkflowBlockKind, WorkflowLabEdgeKind } from "./workflow-block-kinds.js";
import {
  formatWorkflowBlockKind,
  WORKFLOW_BLOCK_KINDS,
  workflowBlockKindColor,
  workflowEdgeColor,
  workflowEdgeShortLabel,
} from "./workflow-block-kinds.js";
import type { WorkflowBlockData, WorkflowLabGraph } from "./workflow-lab-types.js";
import { workflowBlockCaption } from "./workflow-lab-block-caption.js";
import {
  WORKFLOW_BLOCK_HEIGHT,
  WORKFLOW_BLOCK_WIDTH,
} from "./workflow-lab-block-metrics.js";
import { WORKFLOW_LAYOUT } from "./workflow-lab-layout-metrics.js";
import {
  layoutWorkflowLabSwimlanes,
  ORCHESTRATOR_SKILL_ID,
  pipelineRowAgentId,
  pipelineRowIndex,
  PIPELINE_AGENT_IDS,
  workflowLabContentHeight,
} from "./workflow-lab-swimlanes.js";

const NODE_WIDTH = WORKFLOW_BLOCK_WIDTH;
const NODE_HEIGHT = WORKFLOW_BLOCK_HEIGHT;

const PIPELINE_SPINE = new Set<string>(
  PIPELINE_AGENT_IDS.slice(0, -1).map((id, index) => {
    const target = PIPELINE_AGENT_IDS[index + 1];
    return `${id}->${target}`;
  }),
);

function isPipelineSpineEdge(source: string, target: string, kind: WorkflowLabEdgeKind): boolean {
  return kind === "agent-agent" && PIPELINE_SPINE.has(`${source}->${target}`);
}

function isSkillUnifyEdge(source: string, kind: WorkflowLabEdgeKind): boolean {
  return source === ORCHESTRATOR_SKILL_ID && kind === "agent-skill";
}

function edgeLabel(
  kind: WorkflowLabEdgeKind,
  source: string,
  target: string,
  nodeById: Map<string, { kind: string }>,
): string | undefined {
  if (isPipelineSpineEdge(source, target, kind) || isSkillUnifyEdge(source, kind)) {
    return undefined;
  }

  const sourceKind = nodeById.get(source)?.kind;
  const reverseMarkdown =
    kind === "agent-markdown-file" && sourceKind === "markdown_file";

  return workflowEdgeShortLabel(kind, { reverse: reverseMarkdown });
}

function edgeType(
  spine: boolean,
  skillUnify: boolean,
  sameRow: boolean,
): "smoothstep" | "default" {
  if (spine) return "smoothstep";
  if (skillUnify || sameRow) return "default";
  return "default";
}

function edgeClassName(spine: boolean, skillUnify: boolean, kind: WorkflowLabEdgeKind): string {
  const parts = ["workflow-lab-edge"];
  if (spine) parts.push("workflow-lab-edge--spine");
  if (skillUnify) parts.push("workflow-lab-edge--skill-unify");
  parts.push(`workflow-lab-edge--${kind}`);
  return parts.join(" ");
}

interface EdgeRouting {
  sourceHandle?: string;
  targetHandle?: string;
  pathOptions?: { borderRadius: number; offset: number };
}

function edgeRouting(
  source: string,
  target: string,
  kind: WorkflowLabEdgeKind,
): EdgeRouting {
  if (isSkillUnifyEdge(source, kind)) {
    return {
      sourceHandle: "skill-out",
      targetHandle: "in",
      pathOptions: {
        borderRadius: WORKFLOW_LAYOUT.edgeBorderRadius,
        offset: WORKFLOW_LAYOUT.skillEdgeOffset,
      },
    };
  }

  if (isPipelineSpineEdge(source, target, kind)) {
    return {
      sourceHandle: "spawn-out",
      targetHandle: "spawn-in",
      pathOptions: {
        borderRadius: WORKFLOW_LAYOUT.edgeBorderRadius,
        offset: WORKFLOW_LAYOUT.spawnEdgeOffset,
      },
    };
  }

  const sourceRow = pipelineRowIndex(source);
  const targetRow = pipelineRowIndex(target);
  const crossRow = sourceRow >= 0 && targetRow >= 0 && sourceRow !== targetRow;

  if (crossRow) {
    if (targetRow > sourceRow) {
      return {
        sourceHandle: "down",
        targetHandle: pipelineRowAgentId(target) === target ? "spawn-in" : "up",
        pathOptions: {
          borderRadius: WORKFLOW_LAYOUT.edgeBorderRadius,
          offset: WORKFLOW_LAYOUT.spawnEdgeOffset,
        },
      };
    }

    return {
      sourceHandle: "out",
      targetHandle: "in",
      pathOptions: {
        borderRadius: WORKFLOW_LAYOUT.edgeBorderRadius,
        offset: WORKFLOW_LAYOUT.edgeOffset + Math.abs(targetRow - sourceRow) * 32,
      },
    };
  }

  return {
    sourceHandle: "out",
    targetHandle: "in",
    pathOptions: {
      borderRadius: WORKFLOW_LAYOUT.edgeBorderRadius,
      offset: WORKFLOW_LAYOUT.edgeOffset,
    },
  };
}

export { WORKFLOW_BLOCK_KINDS as WORKFLOW_NODE_KINDS };

export function layoutWorkflowLabGraph(graph: WorkflowLabGraph): { nodes: Node[]; edges: Edge[] } {
  const swimlanes = layoutWorkflowLabSwimlanes(NODE_WIDTH, NODE_HEIGHT);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  const groupNodes: Node[] = swimlanes.groups.map((group) => ({
    id: group.id,
    type: "swimlane",
    position: { x: group.x, y: group.y },
    data: { label: group.label, displayLabel: group.displayLabel, accentColor: group.accentColor },
    draggable: false,
    selectable: false,
    connectable: false,
    zIndex: 0,
    style: {
      width: group.width,
      height: group.height,
      backgroundColor: `${group.accentColor}0c`,
      border: `1px solid ${group.accentColor}28`,
      borderRadius: 14,
      pointerEvents: "none",
    },
  }));

  const positionedIds = new Set(swimlanes.positions.keys());
  const cardNodes: Node[] = [];

  for (const [nodeId, layout] of swimlanes.positions.entries()) {
    const node = nodeById.get(nodeId);
    if (!node) continue;

    const isSkill = nodeId === ORCHESTRATOR_SKILL_ID;
    const isRowAgent = pipelineRowAgentId(nodeId) === nodeId;

    const data: WorkflowBlockData = {
      label: node.label,
      caption: workflowBlockCaption(node),
      kind: node.kind,
      agentSystems: node.agentSystems,
      isOrchestratorSkill: isSkill,
      isRowAgent,
    };

    cardNodes.push({
      id: node.id,
      type: "workflowBlock",
      position: { x: layout.x, y: layout.y },
      data,
      className: isSkill ? "workflow-lab-node workflow-lab-node--orchestrator-skill" : "workflow-lab-node",
      zIndex: isSkill ? 3 : 2,
      style: {
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        padding: 0,
        background: "transparent",
        border: "none",
        boxShadow: "none",
      },
    });
  }

  const edges: Edge[] = graph.edges
    .filter((edge) => positionedIds.has(edge.source) && positionedIds.has(edge.target))
    .map((edge) => {
      const spine = isPipelineSpineEdge(edge.source, edge.target, edge.kind);
      const skillUnify = isSkillUnifyEdge(edge.source, edge.kind);
      const sameRow = pipelineRowIndex(edge.source) === pipelineRowIndex(edge.target);
      const color = workflowEdgeColor(edge.kind);
      const routing = edgeRouting(edge.source, edge.target, edge.kind);

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: routing.sourceHandle,
        targetHandle: routing.targetHandle,
        type: edgeType(spine, skillUnify, sameRow),
        animated: spine,
        className: edgeClassName(spine, skillUnify, edge.kind),
        label: edgeLabel(edge.kind, edge.source, edge.target, nodeById),
        style: {
          stroke: color,
          strokeWidth: spine ? 2.5 : skillUnify ? 1.75 : 1.85,
          opacity: skillUnify ? 0.5 : 0.92,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color,
        },
        pathOptions: routing.pathOptions,
        labelStyle: { fill: "#c4c7cc", fontSize: 11, fontWeight: 500 },
        labelBgStyle: { fill: "#0f1116", fillOpacity: 0.92 },
        labelBgPadding: [5, 8] as [number, number],
        labelBgBorderRadius: 6,
        zIndex: spine ? 3 : skillUnify ? 1 : 2,
      };
    });

  return { nodes: [...groupNodes, ...cardNodes], edges };
}

export function nodeKindColor(kind: WorkflowBlockKind): string {
  return workflowBlockKindColor(kind);
}

export function formatNodeKind(kind: WorkflowBlockKind): string {
  return formatWorkflowBlockKind(kind);
}

export function formatEdgeKind(kind: WorkflowLabEdgeKind): string {
  return kind.replaceAll("-", " → ");
}

export function workflowLabCanvasSize(): { width: number; height: number } {
  const swimlanes = layoutWorkflowLabSwimlanes(NODE_WIDTH, NODE_HEIGHT);
  const maxX = Math.max(...swimlanes.groups.map((group) => group.x + group.width), 1200);
  const maxY = Math.max(workflowLabContentHeight(NODE_HEIGHT), 600);
  return { width: maxX + 64, height: maxY + 64 };
}
