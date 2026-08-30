import type { ResourceContentResult } from "../../application/resource-content.js";
import type { InventoryResourceKind, OverlapRelation } from "../../core/model/ecosystem.js";
import type { SourceInfo } from "../../core/model/index.js";
import type {
  EcosystemResourceDetail,
  RelatedPathEntry,
} from "../../server/routes/ecosystem.js";
import { isMarkdownContentKind } from "../../application/resource-content.js";
import {
  buildCompatBadgeTrace,
  CompatBadges,
} from "./CompatBadges.js";
import { MarkdownBody } from "./MarkdownBody.js";
import { PLATFORM_IDS, type PlatformId } from "../../adapters/platform.js";

const KIND_LABELS: Record<InventoryResourceKind, string> = {
  agent: "Agent",
  skill: "Skill",
  mcp_server: "MCP server",
  instruction: "Instruction",
};

interface McpSnapshotModel {
  name?: string;
  transport?: string;
  commandName?: string;
  envKeys: string[];
  headerKeys: string[];
  status?: string;
  definitionKind?: string;
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

export interface ResourceDetailPanelProps {
  detail: EcosystemResourceDetail | null;
  content: ResourceContentResult | null;
  detailLoading?: boolean;
  contentLoading?: boolean;
  detailError?: string | null;
  contentError?: string | null;
  contentUnavailable?: boolean;
  onClose: () => void;
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
}: ResourceDetailPanelProps) {
  const resource = detail?.resource;
  const showContentSection =
    resource !== undefined && isMarkdownContentKind(resource.kind) && !contentUnavailable;

  return (
    <section className="panel resource-detail-panel" aria-labelledby="resource-detail-title">
      <div className="resource-detail-header">
        <h2 id="resource-detail-title">Resource</h2>
        <button type="button" className="resource-detail-close" onClick={onClose}>
          Close
        </button>
      </div>

      {detailLoading && <p className="empty-state">Loading resource details…</p>}
      {!detailLoading && detailError && <p className="error-message">{detailError}</p>}

      {!detailLoading && !detailError && resource && detail && (
        <div className="resource-detail-body">
          <p className="resource-detail-name">{resource.name?.trim() || resource.id}</p>

          <dl className="resource-detail-grid">
            <div>
              <dt>Kind</dt>
              <dd>{KIND_LABELS[resource.kind]}</dd>
            </div>
            <div>
              <dt>Platform</dt>
              <dd>{resource.platform}</dd>
            </div>
            <div>
              <dt>Scope</dt>
              <dd>{resource.scope}</dd>
            </div>
            <div>
              <dt>Resource class</dt>
              <dd className="mono">{resource.resourceClass}</dd>
            </div>
          </dl>

          <section className="resource-detail-section">
            <h3>Compatibility</h3>
            <CompatBadges compat={resource.compat} />
            <ul className="resource-detail-compat-list">
              {PLATFORM_IDS.map((platform) => {
                const trace = buildCompatBadgeTrace(
                  platform as PlatformId,
                  resource.compat[platform] ?? { support: "unknown", enforcement: "unknown" },
                );
                return (
                  <li key={platform} className="resource-detail-compat-item">
                    <span className="resource-detail-compat-platform">{trace.platformLabel}</span>
                    <span className={`resource-detail-compat-state resource-detail-compat-${trace.state}`}>
                      {trace.state}
                    </span>
                    {trace.matrixRef && (
                      <span className="resource-detail-compat-ref mono">{trace.matrixRef}</span>
                    )}
                    {trace.factRefs.length > 0 && (
                      <span className="resource-detail-compat-facts mono">
                        {trace.factRefs.join(", ")}
                      </span>
                    )}
                    <p className="resource-detail-compat-statement">{trace.statement}</p>
                  </li>
                );
              })}
            </ul>
          </section>

          {(detail.relatedFiles.length > 0 || detail.relatedFolders.length > 0) && (
            <section className="resource-detail-section">
              <h3>Source paths</h3>
              {detail.relatedFiles.length > 0 && (
                <>
                  <p className="resource-detail-subheading">Files</p>
                  <ul className="resource-detail-list">
                    {detail.relatedFiles.map((entry: RelatedPathEntry) => (
                      <li key={`${entry.role}:${entry.path}`}>
                        <span className="mono">{entry.path}</span>
                        <span className="resource-detail-role">{entry.role}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {detail.relatedFolders.length > 0 && (
                <>
                  <p className="resource-detail-subheading">Folders</p>
                  <ul className="resource-detail-list">
                    {detail.relatedFolders.map((entry: RelatedPathEntry) => (
                      <li key={`${entry.role}:${entry.path}`}>
                        <span className="mono">{entry.path}</span>
                        <span className="resource-detail-role">{entry.role}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          {detail.overlaps.length > 0 && (
            <section className="resource-detail-section">
              <h3>Collisions</h3>
              <ul className="resource-detail-list">
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
            </section>
          )}

          {resource.kind === "mcp_server" && (
            <section className="resource-detail-section">
              <h3>Redacted model</h3>
              <p className="resource-detail-note">
                Configuration values are never read into Capsight — only structural fields and key
                names are shown.
              </p>
              {(() => {
                const model = extractMcpSnapshotModel(detail.snapshot);
                if (!model) {
                  return <p className="empty-state">No redacted model is available for this resource.</p>;
                }
                return (
                  <dl className="resource-detail-grid">
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
                    <div>
                      <dt>Env keys</dt>
                      <dd className="mono">
                        {model.envKeys.length > 0 ? model.envKeys.join(", ") : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Header keys</dt>
                      <dd className="mono">
                        {model.headerKeys.length > 0 ? model.headerKeys.join(", ") : "—"}
                      </dd>
                    </div>
                  </dl>
                );
              })()}
            </section>
          )}

          {showContentSection && (
            <section className="resource-detail-section">
              <h3>Content</h3>
              {contentLoading && <p className="empty-state">Loading content…</p>}
              {!contentLoading && contentError && (
                <p className="error-message">{contentError}</p>
              )}
              {!contentLoading && !contentError && content && (
                <>
                  {Object.keys(content.frontmatter).length > 0 && (
                    <div className="resource-detail-frontmatter">
                      <p className="resource-detail-subheading">Frontmatter</p>
                      <dl className="resource-detail-grid">
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
                  <MarkdownBody markdown={content.body} />
                </>
              )}
              {!contentLoading && !contentError && !content && (
                <p className="empty-state">No content is available for this resource.</p>
              )}
            </section>
          )}
        </div>
      )}
    </section>
  );
}
