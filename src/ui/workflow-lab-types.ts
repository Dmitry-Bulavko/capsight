import type { WorkflowBlockKind, WorkflowLabEdgeKind } from "./workflow-block-kinds.js";

/** Known agent runtime identifiers for workflow lab mock data. */
export type AgentSystemId =
  | "claude-code"
  | "cursor"
  | "codex"
  | "antigravity"
  | "cline"
  | "devin"
  | "opencode";

export type AgentSystemAvailability = "available" | "unavailable" | "unknown";

/** Maps a workflow block to an agent system and whether it applies there. */
export interface AgentSystemBinding {
  id: AgentSystemId;
  label: string;
  availability: AgentSystemAvailability;
}

export interface WorkflowLabNode {
  id: string;
  kind: WorkflowBlockKind;
  label: string;
  /** Secondary line on the card — path, @file, or config hint. */
  caption?: string;
  agentSystems: AgentSystemBinding[];
}

export interface WorkflowLabEdge {
  id: string;
  source: string;
  target: string;
  kind: WorkflowLabEdgeKind;
}

export interface WorkflowLabGraph {
  nodes: WorkflowLabNode[];
  edges: WorkflowLabEdge[];
}

export type AgentSystemIconTone = "neutral" | "white" | "brand";

export const AGENT_SYSTEM_META: Record<
  AgentSystemId,
  {
    label: string;
    shortLabel: string;
    iconSrc: string;
    iconTone: AgentSystemIconTone;
    iconColor?: string;
  }
> = {
  "claude-code": {
    label: "Claude Code",
    shortLabel: "Claude",
    iconSrc: "/agent-systems/claude-code.png",
    iconTone: "brand",
    iconColor: "#D97757",
  },
  cursor: {
    label: "Cursor",
    shortLabel: "Cursor",
    iconSrc: "/agent-systems/cursor.png",
    iconTone: "neutral",
  },
  codex: {
    label: "Codex",
    shortLabel: "Codex",
    iconSrc: "/agent-systems/codex.png",
    iconTone: "neutral",
  },
  antigravity: {
    label: "Antigravity (Gemini)",
    shortLabel: "Antigravity",
    iconSrc: "/agent-systems/antigravity.png",
    iconTone: "white",
  },
  cline: {
    label: "Cline",
    shortLabel: "Cline",
    iconSrc: "/agent-systems/cline.png",
    iconTone: "white",
  },
  devin: {
    label: "Devin",
    shortLabel: "Devin",
    iconSrc: "/agent-systems/devin.png",
    iconTone: "neutral",
  },
  opencode: {
    label: "OpenCode",
    shortLabel: "OpenCode",
    iconSrc: "/agent-systems/opencode.png",
    iconTone: "white",
  },
};

export interface WorkflowBlockData extends Record<string, unknown> {
  label: string;
  caption?: string;
  kind: WorkflowBlockKind;
  agentSystems: AgentSystemBinding[];
  /** Primary agent in a horizontal row — spawn + skill handles. */
  isRowAgent?: boolean;
  isOrchestratorSkill?: boolean;
}

export function agentSystemAvailabilityHint(binding: AgentSystemBinding): string {
  const verb =
    binding.availability === "available"
      ? "Available"
      : binding.availability === "unavailable"
        ? "Not available"
        : "Availability unknown";
  return `${verb} in ${binding.label}`;
}

export function agentSystemBinding(
  id: AgentSystemId,
  availability: AgentSystemAvailability,
): AgentSystemBinding {
  return {
    id,
    label: AGENT_SYSTEM_META[id].label,
    availability,
  };
}
