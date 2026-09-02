import { useMemo, useState } from "react";
import type { Agent, EffectiveConfiguration, ResolvedCapability, Warning } from "../../core/model/index.js";
import type { ObservedCapability } from "../../core/observed/index.js";
import { CapsightSelect } from "./CapsightSelect.js";
import { ENFORCEMENT_LABELS } from "./WhyPanel.js";
import { capabilityWarningCount } from "./WarningsPanel.js";
import {
  ObservedDisclaimer,
  ObservedStatusBadge,
  resolveObservedStatus,
} from "./ObservedStatus.js";
import {
  buildKindFilterOptions,
  filterAndSortCapabilities,
  KIND_FILTER_ALL,
  KIND_LABELS,
  type KindFilterValue,
} from "./EffectiveCapabilities.js";
import {
  collectEditableTools,
  desiredToolEnabled,
  isEditableToolName,
  type EditorPendingState,
} from "../state/editor-store.js";
import { useAgentPlan } from "../hooks/useAgentPlan.js";
import { opensAsideDetail } from "../capability-aside-detail.js";
import { PlanPreview } from "./PlanPreview.js";
import { CapsightSwitch } from "./CapsightSwitch.js";

export interface CapabilityTableRow {
  id: string;
  capability: ResolvedCapability | null;
  editable: boolean;
}

export function buildCapabilityTableRows(
  agent: Agent | null,
  effective: EffectiveConfiguration | null,
): CapabilityTableRow[] {
  const capabilityById = new Map(
    (effective?.capabilities ?? []).map((capability) => [capability.capabilityId, capability]),
  );
  const editableTools = agent ? collectEditableTools(agent, effective) : [];
  const editableSet = new Set(editableTools);

  const ids = new Set<string>([
    ...(effective?.capabilities ?? []).map((capability) => capability.capabilityId),
    ...editableSet,
  ]);

  return [...ids]
    .sort((left, right) => left.localeCompare(right))
    .map((id) => ({
      id,
      capability: capabilityById.get(id) ?? null,
      editable: editableSet.has(id) && isEditableToolName(id),
    }));
}

function filterTableRows(
  rows: readonly CapabilityTableRow[],
  kindFilter: KindFilterValue,
): CapabilityTableRow[] {
  if (kindFilter === KIND_FILTER_ALL) {
    return [...rows];
  }
  return rows.filter((row) => {
    const kind = row.capability?.kind ?? "tool";
    return kind === kindFilter;
  });
}

interface CapabilitiesTableProps {
  agent: Agent | null;
  effective: EffectiveConfiguration | null;
  loading: boolean;
  error: string | null;
  selectedCapabilityId: string | null;
  onSelectCapability: (capabilityId: string) => void;
  warnings?: readonly Warning[];
  observedById?: ReadonlyMap<string, ObservedCapability> | null;
  observedSessionActive?: boolean;
  observedDisclaimer?: string;
  pending: EditorPendingState;
  onToggleTool: (toolName: string) => void;
  onClearPending: () => void;
}

export function CapabilitiesTable({
  agent,
  effective,
  loading,
  error,
  selectedCapabilityId,
  onSelectCapability,
  warnings = [],
  observedById = null,
  observedSessionActive = false,
  observedDisclaimer,
  pending,
  onToggleTool,
  onClearPending,
}: CapabilitiesTableProps) {
  const [kindFilter, setKindFilter] = useState<KindFilterValue>(KIND_FILTER_ALL);
  const { platform, plan, planLoading, planError, pendingCount, hasPendingEdits } = useAgentPlan(
    agent,
    pending,
  );

  const capabilities = effective?.capabilities ?? [];
  const tableRows = useMemo(() => buildCapabilityTableRows(agent, effective), [agent, effective]);
  const visibleRows = filterTableRows(tableRows, kindFilter);
  const kindFilterOptions = buildKindFilterOptions(capabilities);
  const canEdit = agent?.status === "active";

  return (
    <>
      <section className="panel capabilities-table-panel" data-testid="capabilities-table">
        <div className="capabilities-table-header">
          <h2>
            Capabilities
            {pendingCount > 0 && (
              <span className="pending-badge" title="Unsaved in-memory changes">
                {pendingCount} pending
              </span>
            )}
          </h2>
          <div className="capabilities-table-header-actions">
            {!loading && !error && capabilities.length > 0 && (
              <div className="capability-kind-filter" data-testid="capability-kind-filter">
                <CapsightSelect
                  value={kindFilter}
                  options={kindFilterOptions}
                  onChange={(next) => setKindFilter(next as KindFilterValue)}
                  ariaLabel="Filter capabilities by kind"
                  className="capsight-select--capability-kind-filter"
                />
              </div>
            )}
            {pendingCount > 0 && (
              <button type="button" className="agent-editor-clear" onClick={onClearPending}>
                Discard changes
              </button>
            )}
          </div>
        </div>

        {agent && (
          <p className="agent-editor-note">
            Toggle tools in the Enable column to plan edits — changes stay in memory only and do not
            write files. Click a row to inspect why a capability resolved.
          </p>
        )}

        {agent && !canEdit && (
          <p className="agent-editor-warning">
            Agent status is <code>{agent.status}</code>. Tool toggles are limited to active agents.
          </p>
        )}

        {observedSessionActive && <ObservedDisclaimer disclaimer={observedDisclaimer} />}

        {loading && <p className="empty-state">Loading capabilities…</p>}
        {!loading && error && <p className="error-message">{error}</p>}

        {!loading && !error && effective && tableRows.length === 0 && (
          <p className="empty-state">No capabilities resolved.</p>
        )}

        {!loading && !error && effective && tableRows.length > 0 && visibleRows.length === 0 && (
          <p className="empty-state">No capabilities match this kind filter.</p>
        )}

        {!loading && !error && effective && visibleRows.length > 0 && (
          <div className="capabilities-table-scroll">
            <table className="capabilities-table">
              <thead>
                <tr>
                  <th scope="col" className="capabilities-table-col-enable">
                    Enable
                  </th>
                  <th scope="col">Name</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Enforcement</th>
                  <th scope="col">Status</th>
                  <th scope="col">Observed</th>
                  <th scope="col" className="capabilities-table-col-warnings">
                    Warnings
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const capability = row.capability;
                  const kind = capability?.kind ?? "tool";
                  const status = capability?.status ?? "unknown";
                  const enforcement = capability?.enforcement ?? "unknown";
                  const relatedWarnings = capability
                    ? capabilityWarningCount(capability, warnings)
                    : 0;
                  const observedStatus = resolveObservedStatus(
                    row.id,
                    observedById,
                    observedSessionActive,
                  );
                  const hasOverride =
                    agent !== null && pending.byAgent[agent.id]?.[row.id] !== undefined;
                  const enabled =
                    agent !== null && row.editable
                      ? desiredToolEnabled(agent, pending, row.id)
                      : false;
                  const opensDetail = opensAsideDetail(kind);

                  return (
                    <tr
                      key={row.id}
                      className={`capabilities-table-row${
                        opensDetail ? " capabilities-table-row-selectable" : ""
                      }${
                        opensDetail && selectedCapabilityId === row.id
                          ? " capabilities-table-row-selected"
                          : ""
                      }${capability?.enforcement === "unknown" ? " capabilities-table-row-enforcement-unknown" : ""}`}
                      onClick={() => {
                        if (opensDetail) {
                          onSelectCapability(row.id);
                        }
                      }}
                    >
                      <td
                        className="capabilities-table-cell-enable"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {row.editable && agent ? (
                          <span className="capabilities-table-enable-label">
                            <CapsightSwitch
                              checked={enabled}
                              disabled={!canEdit}
                              ariaLabel={`Enable ${row.id}`}
                              pending={hasOverride}
                              onChange={() => onToggleTool(row.id)}
                            />
                          </span>
                        ) : (
                          <span className="capabilities-table-not-editable" aria-hidden="true">
                            —
                          </span>
                        )}
                      </td>
                      <td className="capabilities-table-cell-name">
                        <span className="mono capabilities-table-name">{row.id}</span>
                      </td>
                      <td>
                        <span
                          className={`capability-kind-badge kind-${kind}`}
                          title={`Kind: ${KIND_LABELS[kind]}`}
                        >
                          {KIND_LABELS[kind]}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`capability-enforcement-badge enforcement-${enforcement}`}
                          title={`Enforcement: ${ENFORCEMENT_LABELS[enforcement]}`}
                        >
                          {enforcement === "unknown" && (
                            <span className="capability-enforcement-unknown-mark" aria-hidden="true">
                              ?
                            </span>
                          )}
                          {ENFORCEMENT_LABELS[enforcement]}
                        </span>
                      </td>
                      <td>
                        <span className={`capability-status-badge status-${status}`}>{status}</span>
                      </td>
                      <td>
                        {observedStatus ? (
                          <ObservedStatusBadge status={observedStatus} compact />
                        ) : (
                          <span className="capabilities-table-not-editable">—</span>
                        )}
                      </td>
                      <td className="capabilities-table-cell-warnings">
                        {relatedWarnings > 0 ? (
                          <span
                            className="capability-warning-badge"
                            title={`${relatedWarnings} warning${relatedWarnings === 1 ? "" : "s"}`}
                          >
                            ⚠ {relatedWarnings}
                          </span>
                        ) : (
                          <span className="capabilities-table-not-editable">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {agent && (
        <PlanPreview
          platform={platform}
          plan={plan}
          loading={planLoading}
          error={planError}
          hasPendingEdits={hasPendingEdits}
        />
      )}
    </>
  );
}
