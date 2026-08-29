import { Handle, Position } from "@xyflow/react";
import {
  AGENT_SYSTEM_META,
  agentSystemAvailabilityHint,
  type AgentSystemAvailability,
  type AgentSystemBinding,
  type AgentSystemId,
  type WorkflowBlockData,
} from "../workflow-lab-types.js";
import {
  formatWorkflowBlockKind,
  WORKFLOW_BLOCK_KIND_META,
  workflowBlockKindColor,
  type WorkflowBlockKind,
} from "../workflow-block-kinds.js";
import { AgentSystemIconMark } from "./AgentSystemIconMark.js";
import { WorkflowBlockKindIcon } from "./WorkflowBlockKindIcon.js";

const SYSTEM_GROUP_ORDER: AgentSystemAvailability[] = ["unavailable", "unknown", "available"];

const SYSTEM_DISPLAY_ORDER = Object.keys(AGENT_SYSTEM_META) as AgentSystemId[];

function groupAgentSystems(bindings: AgentSystemBinding[]): AgentSystemBinding[][] {
  return SYSTEM_GROUP_ORDER.map((availability) =>
    bindings
      .filter((binding) => binding.availability === availability)
      .sort(
        (left, right) =>
          SYSTEM_DISPLAY_ORDER.indexOf(left.id) - SYSTEM_DISPLAY_ORDER.indexOf(right.id),
      ),
  ).filter((group) => group.length > 0);
}

function blockKindHint(kind: WorkflowBlockKind): string {
  return WORKFLOW_BLOCK_KIND_META[kind]?.hint ?? `Block type: ${kind}`;
}

function kindNodeGlow(color: string): string {
  return `0 0 12px ${color}55, 0 0 28px ${color}22`;
}

function AgentSystemIcon({ binding }: { binding: AgentSystemBinding }) {
  const shortLabel = AGENT_SYSTEM_META[binding.id]?.shortLabel ?? binding.label;
  const hint = agentSystemAvailabilityHint(binding);

  return (
    <li
      className={`workflow-block-system-icon workflow-block-system-icon--${binding.availability}`}
      title={hint}
      aria-label={hint}
    >
      <AgentSystemIconMark systemId={binding.id} />
      <span className="visually-hidden">{shortLabel}</span>
    </li>
  );
}

function WorkflowBlockCard({
  label,
  kind,
  agentSystems,
  isRowAgent = false,
  isOrchestratorSkill = false,
}: WorkflowBlockData) {
  const hint = blockKindHint(kind);
  const systemGroups = groupAgentSystems(agentSystems);
  const kindColor = workflowBlockKindColor(kind);

  return (
    <div
      className="workflow-block"
      style={{
        borderColor: kindColor,
        boxShadow: kindNodeGlow(kindColor),
      }}
    >
      {isOrchestratorSkill && (
        <Handle
          id="skill-out"
          type="source"
          position={Position.Right}
          className="workflow-block-handle workflow-block-handle--skill"
        />
      )}

      {isRowAgent && (
        <>
          <Handle
            id="spawn-in"
            type="target"
            position={Position.Top}
            className="workflow-block-handle workflow-block-handle--spawn"
          />
          <Handle
            id="in"
            type="target"
            position={Position.Left}
            className="workflow-block-handle workflow-block-handle--in"
          />
          <Handle
            id="out"
            type="source"
            position={Position.Right}
            className="workflow-block-handle workflow-block-handle--out"
          />
          <Handle
            id="spawn-out"
            type="source"
            position={Position.Bottom}
            className="workflow-block-handle workflow-block-handle--spawn"
          />
        </>
      )}

      {!isRowAgent && !isOrchestratorSkill && (
        <>
          <Handle id="in" type="target" position={Position.Left} className="workflow-block-handle" />
          <Handle id="out" type="source" position={Position.Right} className="workflow-block-handle" />
          <Handle
            id="up"
            type="target"
            position={Position.Top}
            className="workflow-block-handle workflow-block-handle--spawn"
          />
          <Handle
            id="down"
            type="source"
            position={Position.Bottom}
            className="workflow-block-handle workflow-block-handle--spawn"
          />
        </>
      )}

      <div className="workflow-block-header">
        <span className="workflow-block-title">{formatWorkflowBlockKind(kind)}</span>
        <button
          type="button"
          className="workflow-block-kind-trigger nodrag nopan"
          title={hint}
          aria-label={hint}
        >
          <WorkflowBlockKindIcon kind={kind} />
        </button>
      </div>
      <div className="workflow-block-label">{label}</div>
      {systemGroups.length > 0 && (
        <div className="workflow-block-systems">
          <span className="workflow-block-systems-label">Agent systems</span>
          <div className="workflow-block-system-groups" aria-label="Agent systems">
            {systemGroups.map((group) => (
              <ul
                key={group[0]?.availability ?? "group"}
                className={`workflow-block-system-group workflow-block-system-group--${group[0]?.availability ?? "mixed"}`}
              >
                {group.map((binding) => (
                  <AgentSystemIcon key={binding.id} binding={binding} />
                ))}
              </ul>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function workflowBlockNodeTypes() {
  return {
    workflowBlock: ({ data }: { data: WorkflowBlockData }) => <WorkflowBlockCard {...data} />,
  };
}
