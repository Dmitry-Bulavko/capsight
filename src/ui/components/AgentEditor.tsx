import { useEffect, useState } from "react";
import type { PlatformId } from "../../adapters/platform.js";
import type { Agent, EffectiveConfiguration } from "../../core/model/index.js";
import { ApiError, fetchPlan, fetchProject } from "../api.js";
import {
  collectEditableTools,
  countPendingChanges,
  desiredToolEnabled,
  type EditorPendingState,
} from "../state/editor-store.js";
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
  const hasPendingEdits = pendingCount > 0;

  const [platform, setPlatform] = useState<PlatformId>("claude");
  const [editSnapshotId, setEditSnapshotId] = useState<string | null>(null);
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof fetchPlan>> | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProject()
      .then((summary) => {
        if (!cancelled) {
          setPlatform(summary.platform);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPlatform("claude");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasPendingEdits) {
      setEditSnapshotId(null);
      setPlan(null);
      setPlanError(null);
      setPlanLoading(false);
      return;
    }

    if (editSnapshotId !== null) {
      return;
    }

    let cancelled = false;
    setPlanLoading(true);
    fetchPlan({ byAgent: {} }, "capture")
      .then((result) => {
        if (!cancelled) {
          setEditSnapshotId(result.snapshotId);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPlanError(err instanceof Error ? err.message : "Plan failed");
          setPlanLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasPendingEdits, editSnapshotId]);

  useEffect(() => {
    if (!hasPendingEdits || editSnapshotId === null) {
      return;
    }

    let cancelled = false;
    setPlanLoading(true);
    setPlanError(null);

    fetchPlan(pending, editSnapshotId)
      .then((result) => {
        if (!cancelled) {
          setPlan(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setPlanError(err.message);
          } else {
            setPlanError(err instanceof Error ? err.message : "Plan failed");
          }
          setPlan(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPlanLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pending, editSnapshotId, hasPendingEdits]);

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
