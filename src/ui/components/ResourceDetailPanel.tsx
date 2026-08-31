import { useState, type ReactNode } from "react";
import type { ResourceContentResult } from "../../application/resource-content.js";
import { RESOURCE_CLASS } from "../../core/compat/resource-class.js";
import type { InspectionGraph } from "../../core/graph/build-graph.js";
import type { OverlapRelation, InventoryResourceKind } from "../../core/model/ecosystem.js";
import { isMarkdownContentKind } from "../../core/model/ecosystem.js";
import type { Agent, SourceInfo } from "../../core/model/index.js";
import type {
  EcosystemResourceDetail,
  InventoryResourceWithCompat,
  RelatedPathEntry,
} from "../../server/routes/ecosystem.js";
import type { PlatformId } from "../../adapters/platform.js";
import {
  DEFAULT_CONTEXT_PRESET,
  DEFAULT_CONTEXT_REASON,
} from "./ContextSelector.js";
import {
  ecosystemBlockKindColor,
  ecosystemBlockKindHint,
  ecosystemKindGlow,
  formatEcosystemBlockKind,
} from "../ecosystem-block-kinds.js";
import { PLATFORM_ICON_META } from "../platform-icons.js";
import {
  buildCompatBadgeTrace,
  CompatBadges,
} from "./CompatBadges.js";
import { EcosystemBlockKindIcon } from "./EcosystemBlockKindIcon.js";
import { MarkdownBody } from "./MarkdownBody.js";
import { PlatformIconMark } from "./PlatformIconMark.js";
import { PLATFORM_IDS } from "../../adapters/platform.js";

export interface EcosystemBridgeTarget {
  agentId: string;
  capabilityId?: string;
}

export type EcosystemBridgeEvaluation =
  | { state: "disabled"; reason: string }
  | { state: "ready"; target: EcosystemBridgeTarget }
  | {
      state: "choose-agent";
      capabilityId?: string;
      candidateAgentIds: string[];
      reason: string;
    };

export function parseInventoryResourceId(id: string): {
  platform: string;
  kind: InventoryResourceKind;
  resourceId: string;
} {
  const firstColon = id.indexOf(":");
  const secondColon = id.indexOf(":", firstColon + 1);
  if (firstColon === -1 || secondColon === -1) {
    return { platform: "unknown", kind: "agent", resourceId: id };
  }
  return {
    platform: id.slice(0, firstColon),
    kind: id.slice(firstColon + 1, secondColon) as InventoryResourceKind,
    resourceId: id.slice(secondColon + 1),
  };
}

function normalizePathKey(value: string): string {
  return value.replace(/\\/g, "/");
}

function agentIdFromResourcePath(
  agents: readonly Agent[],
  resourcePath: string | undefined,
): string | null {
  if (!resourcePath) {
    return null;
  }
  const normalized = normalizePathKey(resourcePath);
  const agent = agents.find((entry) => normalizePathKey(entry.source.path ?? "") === normalized);
  return agent?.id ?? null;
}

export function capabilityIdFromInventoryResource(
  resource: InventoryResourceWithCompat,
): string | null {
  const { resourceId, kind } = parseInventoryResourceId(resource.id);

  switch (kind) {
    case "agent":
      return null;
    case "skill":
      return resource.name ? `skill:${resource.name}` : null;
    case "instruction":
      return resource.name ? `instruction:${resource.name}` : null;
    case "mcp_server":
      if (resource.resourceClass === RESOURCE_CLASS.MCP_INLINE_AGENT) {
        return null;
      }
      return `mcp-server:${resourceId}`;
    default:
      return null;
  }
}

export function graphTargetNodeIdFromCapability(
  capabilityId: string,
  kind: InventoryResourceKind,
): string {
  if (kind === "skill") {
    return `skill:${capabilityId}`;
  }
  if (kind === "instruction") {
    return `instruction:${capabilityId}`;
  }
  return capabilityId;
}

export function findAgentIdsFromGraph(graph: InspectionGraph, targetNodeId: string): string[] {
  const agentIds: string[] = [];
  for (const edge of graph.edges) {
    if (edge.target !== targetNodeId) {
      continue;
    }
    const match = /^agent:(.+)$/.exec(edge.source);
    if (match) {
      agentIds.push(match[1]);
    }
  }
  return [...new Set(agentIds)].sort((left, right) => left.localeCompare(right));
}

export function evaluateEcosystemBridge(
  resource: InventoryResourceWithCompat,
  agents: readonly Agent[],
  graph: InspectionGraph | null,
): EcosystemBridgeEvaluation {
  if (resource.platform !== "claude") {
    return {
      state: "disabled",
      reason: "Effective resolution is Claude-only in this product.",
    };
  }

  const { kind, resourceId } = parseInventoryResourceId(resource.id);
  const activeAgents = agents.filter((agent) => agent.status === "active");

  if (kind === "agent") {
    const agent = agents.find((entry) => entry.id === resourceId);
    if (!agent) {
      return {
        state: "disabled",
        reason: `Agent "${resourceId}" is not in the current scan — rescan or pick another resource.`,
      };
    }
    return { state: "ready", target: { agentId: agent.id } };
  }

  if (resource.resourceClass === RESOURCE_CLASS.MCP_INLINE_AGENT) {
    const ownerAgentId = agentIdFromResourcePath(agents, resource.path);
    if (ownerAgentId) {
      return { state: "ready", target: { agentId: ownerAgentId } };
    }
    if (activeAgents.length === 0) {
      return {
        state: "disabled",
        reason: "Inline MCP servers resolve inside a specific agent — no active agent is available.",
      };
    }
    return {
      state: "choose-agent",
      candidateAgentIds: activeAgents.map((agent) => agent.id),
      reason: "Inline MCP servers resolve inside a specific agent's configuration — choose which agent to open.",
    };
  }

  const capabilityId = capabilityIdFromInventoryResource(resource);
  if (!capabilityId) {
    return {
      state: "disabled",
      reason: "This declared resource has no unambiguous effective counterpart.",
    };
  }

  const targetNodeId = graphTargetNodeIdFromCapability(capabilityId, kind);
  const candidateAgentIds = graph ? findAgentIdsFromGraph(graph, targetNodeId) : [];

  if (candidateAgentIds.length === 1) {
    return {
      state: "ready",
      target: { agentId: candidateAgentIds[0], capabilityId },
    };
  }

  if (candidateAgentIds.length > 1) {
    return {
      state: "choose-agent",
      capabilityId,
      candidateAgentIds,
      reason:
        "Several agents resolve this capability — choose which effective resolution to open.",
    };
  }

  if (activeAgents.length === 0) {
    return {
      state: "disabled",
      reason: "No active agent is available for effective resolution.",
    };
  }

  return {
    state: "choose-agent",
    capabilityId,
    candidateAgentIds: activeAgents.map((agent) => agent.id),
    reason: "Choose which agent's effective resolution should load this resource.",
  };
}

export function formatBridgeTransitionNotice(
  agentName: string,
  currentPlatform: PlatformId,
): string {
  const platformNote =
    currentPlatform !== "claude"
      ? " The scanned platform will switch to Claude before opening effective resolution."
      : "";
  return `This opens Effective resolution — one context using preset ${DEFAULT_CONTEXT_PRESET} for agent "${agentName}".${platformNote}`;
}

interface McpSnapshotModel {
  name?: string;
  transport?: string;
  commandName?: string;
  envKeys: string[];
  headerKeys: string[];
  status?: string;
  definitionKind?: string;
}

function CloseIcon() {
  return (
    <svg className="resource-detail-close-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 0 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"
      />
    </svg>
  );
}

function formatSourceLine(source: SourceInfo): string {
  const path = source.path ?? source.scope;
  if (source.fieldPath) {
    return `${path} — ${source.fieldPath}`;
  }
  return path;
}

function formatFrontmatterValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => formatFrontmatterValue(entry)).join(", ");
  }
  return JSON.stringify(value);
}

function extractMcpSnapshotModel(snapshot: unknown): McpSnapshotModel | null {
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }

  const record = snapshot as Record<string, unknown>;
  const envKeys = Array.isArray(record.envKeys)
    ? record.envKeys.filter((key): key is string => typeof key === "string")
    : [];
  const headerKeys = Array.isArray(record.headerKeys)
    ? record.headerKeys.filter((key): key is string => typeof key === "string")
    : [];

  let commandName =
    typeof record.commandName === "string" ? record.commandName : undefined;
  if (!commandName && typeof record.command === "string") {
    const parts = record.command.split(/[/\\]/);
    commandName = parts[parts.length - 1] || record.command;
  }

  return {
    name: typeof record.name === "string" ? record.name : undefined,
    transport: typeof record.transport === "string" ? record.transport : undefined,
    commandName,
    envKeys,
    headerKeys,
    status: typeof record.status === "string" ? record.status : undefined,
    definitionKind:
      typeof record.definitionKind === "string" ? record.definitionKind : undefined,
  };
}

function overlapPartnerId(overlap: OverlapRelation, resourceId: string): string {
  return overlap.ids[0] === resourceId ? overlap.ids[1] : overlap.ids[0];
}

function formatOverlapWinner(collision: OverlapRelation["collision"]): string {
  if (collision.effective) {
    return formatSourceLine(collision.effective);
  }
  return "No effective winner — collision unresolved";
}

function SourcePlatformFact({ platform }: { platform: string }) {
  if (platform !== "claude" && platform !== "cursor" && platform !== "codex") {
    return <span>{platform}</span>;
  }

  const meta = PLATFORM_ICON_META[platform as PlatformId];
  return (
    <span className="resource-detail-platform-fact">
      <PlatformIconMark platform={platform as PlatformId} />
      <span>{meta.label}</span>
    </span>
  );
}

function ResourceDetailAccordion({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="resource-detail-accordion" open={defaultOpen || undefined}>
      <summary className="resource-detail-accordion-trigger">{title}</summary>
      <div className="resource-detail-accordion-body">{children}</div>
    </details>
  );
}

export interface ResourceDetailPanelProps {
  detail: EcosystemResourceDetail | null;
  content: ResourceContentResult | null;
  detailLoading?: boolean;
  contentLoading?: boolean;
  detailError?: string | null;
  contentError?: string | null;
  contentUnavailable?: boolean;
  onClose: () => void;
  agents?: Agent[];
  bridgeEvaluation?: EcosystemBridgeEvaluation | null;
  bridgeEvaluationLoading?: boolean;
  currentPlatform?: PlatformId;
  onBridgeRequest?: (target: EcosystemBridgeTarget) => void;
}

export function ResourceDetailPanel({
  detail,
  content,
  detailLoading = false,
  contentLoading = false,
  detailError = null,
  contentError = null,
  contentUnavailable = false,
  onClose,
  agents = [],
  bridgeEvaluation = null,
  bridgeEvaluationLoading = false,
  currentPlatform = "claude",
  onBridgeRequest,
}: ResourceDetailPanelProps) {
  const [bridgeConfirmOpen, setBridgeConfirmOpen] = useState(false);
  const [selectedBridgeAgentId, setSelectedBridgeAgentId] = useState<string | null>(null);

  const resource = detail?.resource;
  const showContentSection =
    resource !== undefined && isMarkdownContentKind(resource.kind) && !contentUnavailable;
  const kindColor = resource ? ecosystemBlockKindColor(resource.kind) : undefined;

  const bridgeAgentName = (agentId: string): string => {
    const agent = agents.find((entry) => entry.id === agentId);
    return agent?.name ?? agentId;
  };

  const resetBridgeUi = () => {
    setBridgeConfirmOpen(false);
    setSelectedBridgeAgentId(null);
  };

  const handleOpenBridgeConfirm = () => {
    if (!bridgeEvaluation || bridgeEvaluation.state === "disabled") {
      return;
    }
    if (bridgeEvaluation.state === "ready") {
      setSelectedBridgeAgentId(bridgeEvaluation.target.agentId);
    } else if (bridgeEvaluation.state === "choose-agent") {
      setSelectedBridgeAgentId(bridgeEvaluation.candidateAgentIds[0] ?? null);
    }
    setBridgeConfirmOpen(true);
  };

  const handleConfirmBridge = () => {
    if (!onBridgeRequest || !bridgeEvaluation || bridgeEvaluation.state === "disabled") {
      return;
    }

    if (bridgeEvaluation.state === "ready") {
      onBridgeRequest(bridgeEvaluation.target);
      resetBridgeUi();
      return;
    }

    if (!selectedBridgeAgentId) {
      return;
    }

    onBridgeRequest({
      agentId: selectedBridgeAgentId,
      ...(bridgeEvaluation.capabilityId ? { capabilityId: bridgeEvaluation.capabilityId } : {}),
    });
    resetBridgeUi();
  };

  const bridgeDisabledReason =
    bridgeEvaluation?.state === "disabled" ? bridgeEvaluation.reason : null;
  const bridgeActionEnabled =
    onBridgeRequest &&
    bridgeEvaluation &&
    bridgeEvaluation.state !== "disabled" &&
    !bridgeEvaluationLoading;
  const showBridgeSection = onBridgeRequest !== undefined;

  return (
    <section
      className="resource-detail-panel"
      style={
        kindColor
          ? {
              borderColor: kindColor,
              boxShadow: ecosystemKindGlow(kindColor),
            }
          : undefined
      }
      aria-labelledby="resource-detail-title"
    >
      <div className="resource-detail-panel-body">
      {detailLoading && <p className="resource-detail-status empty-state">Loading resource details…</p>}
      {!detailLoading && detailError && (
        <p className="resource-detail-status error-message">{detailError}</p>
      )}

      {!detailLoading && !detailError && resource && detail && (
        <>
          <header className="resource-detail-card-header">
            <div className="resource-detail-card-heading">
              <span className="resource-detail-card-kind">
                {formatEcosystemBlockKind(resource.kind)}
              </span>
              <h2 id="resource-detail-title" className="resource-detail-card-title">
                {resource.name?.trim() || resource.id}
              </h2>
            </div>
            <div className="resource-detail-card-actions">
              <span
                className="resource-detail-card-kind-icon"
                title={ecosystemBlockKindHint(resource.kind)}
                aria-label={ecosystemBlockKindHint(resource.kind)}
              >
                <EcosystemBlockKindIcon kind={resource.kind} />
              </span>
              <button
                type="button"
                className="resource-detail-close"
                onClick={onClose}
                aria-label="Close resource details"
              >
                <CloseIcon />
              </button>
            </div>
          </header>

          {showBridgeSection && (
            <div className="resource-detail-bridge" data-testid="ecosystem-effective-bridge">
              <h3 className="resource-detail-bridge-title">Effective resolution</h3>
              {bridgeEvaluationLoading && (
                <p className="resource-detail-bridge-note empty-state">
                  Checking effective bridge…
                </p>
              )}
              {!bridgeEvaluationLoading && bridgeDisabledReason && (
                <p className="resource-detail-bridge-note resource-detail-bridge-disabled">
                  {bridgeDisabledReason}
                </p>
              )}
              {!bridgeEvaluationLoading && !bridgeDisabledReason && bridgeEvaluation && (
                <>
                  {!bridgeConfirmOpen && (
                    <button
                      type="button"
                      className="resource-detail-bridge-action"
                      disabled={!bridgeActionEnabled}
                      onClick={handleOpenBridgeConfirm}
                    >
                      Open effective resolution
                    </button>
                  )}
                  {bridgeConfirmOpen && (
                    <div className="resource-detail-bridge-confirm">
                      {bridgeEvaluation.state === "choose-agent" && (
                        <fieldset className="resource-detail-bridge-agent-choice">
                          <legend>{bridgeEvaluation.reason}</legend>
                          <ul className="resource-detail-bridge-agent-list">
                            {bridgeEvaluation.candidateAgentIds.map((agentId) => (
                              <li key={agentId}>
                                <label className="resource-detail-bridge-agent-option">
                                  <input
                                    type="radio"
                                    name="bridge-agent"
                                    value={agentId}
                                    checked={selectedBridgeAgentId === agentId}
                                    onChange={() => setSelectedBridgeAgentId(agentId)}
                                  />
                                  <span>{bridgeAgentName(agentId)}</span>
                                  <code className="mono">{agentId}</code>
                                </label>
                              </li>
                            ))}
                          </ul>
                        </fieldset>
                      )}
                      {bridgeEvaluation.state === "ready" && (
                        <p className="resource-detail-bridge-note">
                          {formatBridgeTransitionNotice(
                            bridgeAgentName(bridgeEvaluation.target.agentId),
                            currentPlatform,
                          )}
                        </p>
                      )}
                      {bridgeEvaluation.state === "choose-agent" && selectedBridgeAgentId && (
                        <p className="resource-detail-bridge-note">
                          {formatBridgeTransitionNotice(
                            bridgeAgentName(selectedBridgeAgentId),
                            currentPlatform,
                          )}
                        </p>
                      )}
                      <p className="resource-detail-bridge-context-note">
                        <code>{DEFAULT_CONTEXT_PRESET}</code> — {DEFAULT_CONTEXT_REASON}
                      </p>
                      <div className="resource-detail-bridge-actions">
                        <button
                          type="button"
                          className="resource-detail-bridge-action"
                          disabled={!selectedBridgeAgentId}
                          onClick={handleConfirmBridge}
                        >
                          Open effective resolution
                        </button>
                        <button
                          type="button"
                          className="resource-detail-bridge-cancel"
                          onClick={resetBridgeUi}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="resource-detail-accordions">
            <ResourceDetailAccordion title="Metadata">
              <div className="resource-detail-meta">
            <dl className="resource-detail-facts">
              <div>
                <dt>Platform</dt>
                <dd>
                  <SourcePlatformFact platform={resource.platform} />
                </dd>
              </div>
              <div>
                <dt>Scope</dt>
                <dd>
                  {resource.scope}
                  {resource.scope === "local" && (
                    <span className="resource-detail-scope-badge">local</span>
                  )}
                </dd>
              </div>
              <div className="resource-detail-fact-wide">
                <dt>Resource class</dt>
                <dd className="mono" title={resource.resourceClass}>
                  {resource.resourceClass}
                </dd>
              </div>
            </dl>

            <div className="resource-detail-meta-block">
              <h3 className="resource-detail-meta-label">Compatibility</h3>
              <CompatBadges compat={resource.compat} />
              <ul className="resource-detail-compat-list">
                {PLATFORM_IDS.map((platform) => {
                  const trace = buildCompatBadgeTrace(
                    platform as PlatformId,
                    resource.compat[platform] ?? { support: "unknown", enforcement: "unknown" },
                  );
                  return (
                    <li key={platform} className="resource-detail-compat-item">
                      <div className="resource-detail-compat-head">
                        <span className="resource-detail-compat-platform">{trace.platformLabel}</span>
                        <span
                          className={`resource-detail-compat-state resource-detail-compat-${trace.state}`}
                        >
                          {trace.state}
                        </span>
                      </div>
                      {(trace.matrixRef || trace.factRefs.length > 0) && (
                        <p className="resource-detail-compat-refs mono">
                          {[trace.matrixRef, ...trace.factRefs].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      <p className="resource-detail-compat-statement">{trace.statement}</p>
                    </li>
                  );
                })}
              </ul>
            </div>

            {(detail.relatedFiles.length > 0 || detail.relatedFolders.length > 0) && (
              <div className="resource-detail-meta-block">
                <h3 className="resource-detail-meta-label">Source paths</h3>
                {detail.relatedFiles.length > 0 && (
                  <ul className="resource-detail-path-list">
                    {detail.relatedFiles.map((entry: RelatedPathEntry) => (
                      <li key={`${entry.role}:${entry.path}`}>
                        <span className="mono" title={entry.path}>
                          {entry.path}
                        </span>
                        <span className="resource-detail-role">{entry.role}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {detail.relatedFolders.length > 0 && (
                  <ul className="resource-detail-path-list">
                    {detail.relatedFolders.map((entry: RelatedPathEntry) => (
                      <li key={`${entry.role}:${entry.path}`}>
                        <span className="mono" title={entry.path}>
                          {entry.path}
                        </span>
                        <span className="resource-detail-role">{entry.role}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {detail.overlaps.length > 0 && (
              <div className="resource-detail-meta-block">
                <h3 className="resource-detail-meta-label">Collisions</h3>
                <ul className="resource-detail-path-list">
                  {detail.overlaps.map((overlap) => (
                    <li key={overlap.ids.join(":")} className="resource-detail-overlap">
                      <span className="mono">↔ {overlapPartnerId(overlap, resource.id)}</span>
                      <span className="resource-detail-role">rule {overlap.collision.rule}</span>
                      <span className="resource-detail-overlap-winner">
                        Winner: {formatOverlapWinner(overlap.collision)}
                      </span>
                      {overlap.collision.matrixRef && (
                        <span className="resource-detail-compat-ref mono">
                          {overlap.collision.matrixRef}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {resource.kind === "mcp_server" && (
              <div className="resource-detail-meta-block">
                <h3 className="resource-detail-meta-label">Redacted model</h3>
                <p className="resource-detail-note">
                  Configuration values are never read into Capsight — only structural fields and key
                  names are shown.
                </p>
                {(() => {
                  const model = extractMcpSnapshotModel(detail.snapshot);
                  if (!model) {
                    return (
                      <p className="empty-state">No redacted model is available for this resource.</p>
                    );
                  }
                  return (
                    <dl className="resource-detail-facts">
                      {model.name && (
                        <div>
                          <dt>Server name</dt>
                          <dd>{model.name}</dd>
                        </div>
                      )}
                      {model.transport && (
                        <div>
                          <dt>Transport</dt>
                          <dd>{model.transport}</dd>
                        </div>
                      )}
                      {model.commandName && (
                        <div>
                          <dt>Command</dt>
                          <dd className="mono">{model.commandName}</dd>
                        </div>
                      )}
                      {model.definitionKind && (
                        <div>
                          <dt>Definition</dt>
                          <dd>{model.definitionKind}</dd>
                        </div>
                      )}
                      {model.status && (
                        <div>
                          <dt>Status</dt>
                          <dd>{model.status}</dd>
                        </div>
                      )}
                      <div className="resource-detail-fact-wide">
                        <dt>Env keys</dt>
                        <dd className="mono">
                          {model.envKeys.length > 0 ? model.envKeys.join(", ") : "—"}
                        </dd>
                      </div>
                      <div className="resource-detail-fact-wide">
                        <dt>Header keys</dt>
                        <dd className="mono">
                          {model.headerKeys.length > 0 ? model.headerKeys.join(", ") : "—"}
                        </dd>
                      </div>
                    </dl>
                  );
                })()}
              </div>
            )}
              </div>
            </ResourceDetailAccordion>

          {showContentSection && (
            <ResourceDetailAccordion title="Content">
              <div className="resource-detail-content">
              {contentLoading && <p className="empty-state">Loading content…</p>}
              {!contentLoading && contentError && <p className="error-message">{contentError}</p>}
              {!contentLoading && !contentError && content && (
                <>
                  {Object.keys(content.frontmatter).length > 0 && (
                    <div className="resource-detail-frontmatter">
                      <p className="resource-detail-meta-label">Frontmatter</p>
                      <dl className="resource-detail-facts">
                        {Object.entries(content.frontmatter).map(([key, value]) => (
                          <div key={key}>
                            <dt>{key}</dt>
                            <dd>{formatFrontmatterValue(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                  {content.truncated && (
                    <p className="resource-detail-warning">
                      Body truncated — file exceeds the read cap and only the first portion is shown.
                    </p>
                  )}
                  <div className="resource-detail-markdown-scroll">
                    <MarkdownBody markdown={content.body} />
                  </div>
                </>
              )}
              {!contentLoading && !contentError && !content && (
                <p className="empty-state">No content is available for this resource.</p>
              )}
              </div>
            </ResourceDetailAccordion>
          )}
          </div>
        </>
      )}
      </div>
    </section>
  );
}
