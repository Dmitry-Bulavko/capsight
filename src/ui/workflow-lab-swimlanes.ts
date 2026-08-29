import { WORKFLOW_LAYOUT } from "./workflow-lab-layout-metrics.js";

/** Orchestrator skill — left anchor, ties subagent rows together. */
export const ORCHESTRATOR_SKILL_ID = "demo-skill-orchestrator";

/** One horizontal row: primary agent first, then its related blocks left → right. */
export interface PipelineRow {
  id: string;
  label: string;
  /** Uppercase row header shown on the group box. */
  displayLabel: string;
  accentColor: string;
  /** Agent node id — must be first in nodeIds. */
  agentId: string;
  nodeIds: readonly string[];
}

export const PIPELINE_ROWS: readonly PipelineRow[] = [
  {
    id: "orchestrator",
    label: "orchestrator",
    displayLabel: "ORCHESTRATOR",
    accentColor: "#8ab4f8",
    agentId: "demo-orchestrator",
    nodeIds: ["demo-orchestrator", "demo-md-roadmap", "demo-md-spec", "demo-md-orchestrator"],
  },
  {
    id: "ba",
    label: "business-analyst",
    displayLabel: "BUSINESS ANALYST",
    accentColor: "#9ecbff",
    agentId: "demo-ba",
    nodeIds: ["demo-ba", "demo-md-ba", "demo-md-tasks"],
  },
  {
    id: "architect",
    label: "architect",
    displayLabel: "ARCHITECT",
    accentColor: "#c58af9",
    agentId: "demo-architect",
    nodeIds: ["demo-architect", "demo-md-architect", "demo-md-handoff"],
  },
  {
    id: "implementer",
    label: "implementer",
    displayLabel: "IMPLEMENTER",
    accentColor: "#81c995",
    agentId: "demo-implementer",
    nodeIds: ["demo-implementer", "demo-md-implementer", "demo-code-patch"],
  },
  {
    id: "code-review",
    label: "code-reviewer",
    displayLabel: "CODE REVIEWER",
    accentColor: "#fdd663",
    agentId: "demo-code-reviewer",
    nodeIds: ["demo-code-reviewer", "demo-md-code-reviewer", "demo-skill-review"],
  },
  {
    id: "spec-review",
    label: "spec-reviewer",
    displayLabel: "SPEC REVIEWER",
    accentColor: "#78d9ec",
    agentId: "demo-spec-reviewer",
    nodeIds: ["demo-spec-reviewer", "demo-md-spec-reviewer"],
  },
  {
    id: "release",
    label: "pr-author",
    displayLabel: "PR AUTHOR",
    accentColor: "#f28b82",
    agentId: "demo-pr-agent",
    nodeIds: ["demo-pr-agent", "demo-md-pr-agent", "demo-mcp-github", "demo-mcp-create-pr"],
  },
];

/** Spawn order for animated spine (orchestrator → … → pr-author). */
export const PIPELINE_AGENT_IDS = PIPELINE_ROWS.map((row) => row.agentId);

export interface LaneLayoutNode {
  id: string;
  x: number;
  y: number;
}

export interface LaneLayoutGroup {
  id: string;
  label: string;
  displayLabel: string;
  hint: string;
  x: number;
  y: number;
  width: number;
  height: number;
  accentColor: string;
}

export interface SwimlaneLayoutResult {
  groups: LaneLayoutGroup[];
  positions: Map<string, LaneLayoutNode>;
  skillId: string;
}

function rowWidth(nodeCount: number, nodeWidth: number, gap: number): number {
  if (nodeCount <= 0) return 0;
  return nodeCount * nodeWidth + Math.max(0, nodeCount - 1) * gap;
}

function boundsForNodes(
  positions: Map<string, LaneLayoutNode>,
  nodeIds: readonly string[],
  nodeWidth: number,
  nodeHeight: number,
  padding: number,
): { x: number; y: number; width: number; height: number } | null {
  const coords = nodeIds
    .map((id) => positions.get(id))
    .filter((pos): pos is LaneLayoutNode => pos !== undefined);

  if (coords.length === 0) return null;

  const minX = Math.min(...coords.map((c) => c.x));
  const minY = Math.min(...coords.map((c) => c.y));
  const maxX = Math.max(...coords.map((c) => c.x)) + nodeWidth;
  const maxY = Math.max(...coords.map((c) => c.y)) + nodeHeight;

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

export function layoutWorkflowLabSwimlanes(
  nodeWidth: number,
  nodeHeight: number,
): SwimlaneLayoutResult {
  const positions = new Map<string, LaneLayoutNode>();
  const rowsStartX =
    WORKFLOW_LAYOUT.canvasOriginX + nodeWidth + WORKFLOW_LAYOUT.skillColumnGap;

  const rowCount = PIPELINE_ROWS.length;
  const skillY = WORKFLOW_LAYOUT.rowPadTop;

  positions.set(ORCHESTRATOR_SKILL_ID, {
    id: ORCHESTRATOR_SKILL_ID,
    x: WORKFLOW_LAYOUT.canvasOriginX,
    y: skillY,
  });

  PIPELINE_ROWS.forEach((row, rowIndex) => {
    const rowY = WORKFLOW_LAYOUT.rowPadTop + rowIndex * (nodeHeight + WORKFLOW_LAYOUT.rowGap);

    row.nodeIds.forEach((nodeId, colIndex) => {
      positions.set(nodeId, {
        id: nodeId,
        x: rowsStartX + colIndex * (nodeWidth + WORKFLOW_LAYOUT.nodeGapH),
        y: rowY,
      });
    });
  });

  const groups: LaneLayoutGroup[] = PIPELINE_ROWS.flatMap((row) => {
    const bounds = boundsForNodes(
      positions,
      row.nodeIds,
      nodeWidth,
      nodeHeight,
      WORKFLOW_LAYOUT.rowBandPad,
    );
    if (!bounds) return [];

    return [
      {
        id: `row-${row.id}`,
        label: row.label,
        displayLabel: row.displayLabel,
        hint: "Agent stream — primary agent and its related blocks",
        accentColor: row.accentColor,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      },
    ];
  });

  return { groups, positions, skillId: ORCHESTRATOR_SKILL_ID };
}

export function workflowLabContentHeight(nodeHeight: number): number {
  const rowCount = PIPELINE_ROWS.length;
  return (
    WORKFLOW_LAYOUT.rowPadTop +
    rowCount * nodeHeight +
    Math.max(0, rowCount - 1) * WORKFLOW_LAYOUT.rowGap +
    WORKFLOW_LAYOUT.canvasBottomPad
  );
}

export function pipelineRowIndex(nodeId: string): number {
  return PIPELINE_ROWS.findIndex((row) => row.nodeIds.includes(nodeId));
}

export function pipelineRowAgentId(nodeId: string): string | undefined {
  return PIPELINE_ROWS.find((row) => row.nodeIds.includes(nodeId))?.agentId;
}
