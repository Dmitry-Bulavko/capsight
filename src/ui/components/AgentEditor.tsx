import type { Agent, EffectiveConfiguration } from "../../core/model/index.js";
import {
  collectEditableTools,
  countPendingChanges,
  desiredToolEnabled,
  type EditorPendingState,
} from "../state/editor-store.js";
import { useAgentPlan } from "../hooks/useAgentPlan.js";
import { PlanPreview } from "./PlanPreview.js";

interface AgentEditorProps {
  agent: Agent;
  effective: EffectiveConfiguration | null;
  effectiveLoading: boolean;
  pending: EditorPendingState;
  onToggleTool: (toolName: string) => void;
  onClearPending: () => void;
}

function effectiveStatusByTool(
  effective: EffectiveConfiguration | null,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!effective) {
    return map;
  }
  for (const capability of effective.capabilities) {
    if (capability.kind === "tool" || capability.kind === "mcp_tool") {
      map.set(capability.capabilityId, capability.status);
    }
  }
  return map;
}

export function AgentEditor({
  agent,
  effective,
  effectiveLoading,
  pending,
  onToggleTool,
  onClearPending,
}: AgentEditorProps) {
  const pendingCount = countPendingChanges(agent, pending);
  const editableTools = collectEditableTools(agent, effective);
  const effectiveStatus = effectiveStatusByTool(effective);
  const canEdit = agent.status === "active";
  const { platform, plan, planLoading, planError, hasPendingEdits } = useAgentPlan(agent, pending);

  return (
    <>
      <section className="panel agent-editor">
        <div className="agent-editor-header">
          <h2>
            Agent editor
            {pendingCount > 0 && (
              <span className="pending-badge" title="Unsaved in-memory changes">
                {pendingCount} pending
              </span>
            )}
          </h2>
          {pendingCount > 0 && (
            <button type="button" className="agent-editor-clear" onClick={onClearPending}>
              Discard changes
            </button>
          )}
        </div>

        <p className="agent-editor-note">
          Changes stay in memory only — clicking a tool checkbox does not write files.
        </p>

        {!canEdit && (
          <p className="agent-editor-warning">
            Agent status is <code>{agent.status}</code>. Editing is limited to active agents.
          </p>
        )}

        {effectiveLoading && <p className="empty-state">Loading tool list…</p>}

        {!effectiveLoading && editableTools.length === 0 && (
          <p className="empty-state">No editable tools found for this agent.</p>
        )}

        {!effectiveLoading && editableTools.length > 0 && (
          <ul className="agent-editor-tools">
            {editableTools.map((toolName) => {
              const enabled = desiredToolEnabled(agent, pending, toolName);
              const hasOverride = pending.byAgent[agent.id]?.[toolName] !== undefined;
              const status = effectiveStatus.get(toolName);

              return (
                <li key={toolName} className="agent-editor-tool">
                  <label className="agent-editor-tool-label">
                    <input
                      type="checkbox"
                      checked={enabled}
                      disabled={!canEdit}
                      onChange={() => onToggleTool(toolName)}
                    />
                    <span className="mono agent-editor-tool-name">{toolName}</span>
                  </label>
                  <span className="agent-editor-tool-meta">
                    {hasOverride && <span className="pending-dot" title="Pending change" />}
                    {status && (
                      <span className={`capability-status-badge status-${status}`}>{status}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <PlanPreview
        platform={platform}
        plan={plan}
        loading={planLoading}
        error={planError}
        hasPendingEdits={hasPendingEdits}
      />
    </>
  );
}
