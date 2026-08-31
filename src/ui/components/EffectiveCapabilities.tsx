import { useState } from "react";
import type { EffectiveConfiguration, ResolvedCapability, Warning } from "../../core/model/index.js";
import { CapsightSelect, type CapsightSelectOption } from "./CapsightSelect.js";
import { ENFORCEMENT_LABELS } from "./WhyPanel.js";
import { capabilityWarningCount } from "./WarningsPanel.js";

export const KIND_FILTER_ALL = "all" as const;

export type KindFilterValue = ResolvedCapability["kind"] | typeof KIND_FILTER_ALL;

export const KIND_LABELS: Record<ResolvedCapability["kind"], string> = {
  tool: "Tool",
  mcp_server: "MCP server",
  mcp_tool: "MCP tool",
  skill: "Skill",
  instruction: "Instruction",
  permission: "Permission",
};

const KIND_ORDER: readonly ResolvedCapability["kind"][] = [
  "tool",
  "mcp_server",
  "mcp_tool",
  "skill",
  "instruction",
  "permission",
];

export function buildKindFilterOptions(
  capabilities: readonly ResolvedCapability[],
): CapsightSelectOption[] {
  const presentKinds = new Set(capabilities.map((capability) => capability.kind));
  return [
    { value: KIND_FILTER_ALL, label: "All kinds" },
    ...KIND_ORDER.filter((kind) => presentKinds.has(kind)).map((kind) => ({
      value: kind,
      label: KIND_LABELS[kind],
    })),
  ];
}

export function filterAndSortCapabilities(
  capabilities: readonly ResolvedCapability[],
  kindFilter: KindFilterValue,
): ResolvedCapability[] {
  const filtered =
    kindFilter === KIND_FILTER_ALL
      ? capabilities
      : capabilities.filter((capability) => capability.kind === kindFilter);
  return [...filtered].sort((a, b) => a.capabilityId.localeCompare(b.capabilityId));
}

interface EffectiveCapabilitiesProps {
  effective: EffectiveConfiguration | null;
  loading: boolean;
  error: string | null;
  selectedCapabilityId: string | null;
  onSelectCapability: (capabilityId: string) => void;
  warnings?: readonly Warning[];
  kindFilter?: KindFilterValue;
  onKindFilterChange?: (value: KindFilterValue) => void;
}

export function EffectiveCapabilities({
  effective,
  loading,
  error,
  selectedCapabilityId,
  onSelectCapability,
  warnings = [],
  kindFilter: kindFilterProp,
  onKindFilterChange,
}: EffectiveCapabilitiesProps) {
  const [internalKindFilter, setInternalKindFilter] = useState<KindFilterValue>(KIND_FILTER_ALL);
  const kindFilter = kindFilterProp ?? internalKindFilter;
  const setKindFilter = onKindFilterChange ?? setInternalKindFilter;

  const capabilities = effective?.capabilities ?? [];
  const visibleCapabilities = filterAndSortCapabilities(capabilities, kindFilter);
  const kindFilterOptions = buildKindFilterOptions(capabilities);

  return (
    <section className="panel effective-capabilities">
      <div className="effective-capabilities-header">
        <h2>Effective capabilities</h2>
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
      </div>
      {loading && <p className="empty-state">Loading capabilities…</p>}
      {!loading && error && <p className="error-message">{error}</p>}
      {!loading && !error && effective && (
        <>
          {capabilities.length === 0 ? (
            <p className="empty-state">No capabilities resolved.</p>
          ) : visibleCapabilities.length === 0 ? (
            <p className="empty-state">No capabilities match this kind filter.</p>
          ) : (
            <ul className="capability-items capability-items-grid">
              {visibleCapabilities.map((capability) => {
                const relatedWarnings = capabilityWarningCount(capability, warnings);
                return (
                  <li key={capability.capabilityId}>
                    <button
                      type="button"
                      className={`capability-item capability-status-${capability.status}${
                        capability.enforcement === "unknown" ? " capability-item-enforcement-unknown" : ""
                      }${
                        selectedCapabilityId === capability.capabilityId
                          ? " capability-item-selected"
                          : ""
                      }`}
                      onClick={() => onSelectCapability(capability.capabilityId)}
                    >
                      <span className="capability-item-primary">
                        <span className="capability-id mono">{capability.capabilityId}</span>
                        <span
                          className={`capability-kind-badge kind-${capability.kind}`}
                          title={`Kind: ${KIND_LABELS[capability.kind]}`}
                        >
                          {KIND_LABELS[capability.kind]}
                        </span>
                      </span>
                      <span className="capability-item-badges">
                        <span
                          className={`capability-enforcement-badge enforcement-${capability.enforcement}`}
                          title={`Enforcement: ${ENFORCEMENT_LABELS[capability.enforcement]}`}
                        >
                          {capability.enforcement === "unknown" && (
                            <span className="capability-enforcement-unknown-mark" aria-hidden="true">
                              ?
                            </span>
                          )}
                          {ENFORCEMENT_LABELS[capability.enforcement]}
                        </span>
                        {relatedWarnings > 0 && (
                          <span
                            className="capability-warning-badge"
                            title={`${relatedWarnings} warning${relatedWarnings === 1 ? "" : "s"}`}
                            aria-label={`${relatedWarnings} warning${relatedWarnings === 1 ? "" : "s"}`}
                          >
                            ⚠ {relatedWarnings}
                          </span>
                        )}
                        <span className={`capability-status-badge status-${capability.status}`}>
                          {capability.status}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
