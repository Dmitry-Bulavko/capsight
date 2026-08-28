import type { ScanStatusSummary } from "../../application/scan-store.js";
import { formatVersion } from "../api.js";

export interface ResourceCounts {
  skills: number;
  instructions: number;
  mcpServers: number;
}

interface ProjectSummaryProps {
  summary: ScanStatusSummary;
  resourceCounts: ResourceCounts;
  variant?: "panel" | "stats";
}

export function ProjectSummary({
  summary,
  resourceCounts,
  variant = "panel",
}: ProjectSummaryProps) {
  const { agents } = summary;

  if (variant === "stats") {
    return (
      <section className="dashboard-stats" aria-label="Project overview">
        <article className="stat-card stat-card-wide">
          <span className="stat-label">Path</span>
          <span className="stat-value mono truncate" title={summary.projectPath}>
            {summary.projectPath}
          </span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Claude version</span>
          <span className="stat-value">{formatVersion(summary.version)}</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Scanned at</span>
          <span className="stat-value">{new Date(summary.scannedAt).toLocaleString()}</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Agents</span>
          <span className="stat-value stat-value-pills">
            <span className="count-pill count-active">{agents.active} active</span>
            {agents.invalid > 0 && (
              <span className="count-pill count-invalid">{agents.invalid} invalid</span>
            )}
            {agents.ambiguous > 0 && (
              <span className="count-pill count-ambiguous">{agents.ambiguous} ambiguous</span>
            )}
            {agents.shadowed > 0 && (
              <span className="count-pill count-shadowed">{agents.shadowed} shadowed</span>
            )}
          </span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Skills</span>
          <span className="stat-value">{resourceCounts.skills}</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Instructions</span>
          <span className="stat-value">{resourceCounts.instructions}</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">MCP servers</span>
          <span className="stat-value">{resourceCounts.mcpServers}</span>
        </article>
      </section>
    );
  }

  return (
    <section className="panel project-summary">
      <h2>Project</h2>
      <dl className="summary-grid">
        <div>
          <dt>Path</dt>
          <dd className="mono truncate" title={summary.projectPath}>
            {summary.projectPath}
          </dd>
        </div>
        <div>
          <dt>Claude version</dt>
          <dd>{formatVersion(summary.version)}</dd>
        </div>
        <div>
          <dt>Scanned at</dt>
          <dd>{new Date(summary.scannedAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Agents</dt>
          <dd>
            <span className="count-pill count-active">{agents.active} active</span>
            {agents.invalid > 0 && (
              <span className="count-pill count-invalid">{agents.invalid} invalid</span>
            )}
            {agents.ambiguous > 0 && (
              <span className="count-pill count-ambiguous">{agents.ambiguous} ambiguous</span>
            )}
            {agents.shadowed > 0 && (
              <span className="count-pill count-shadowed">{agents.shadowed} shadowed</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Skills</dt>
          <dd>{resourceCounts.skills}</dd>
        </div>
        <div>
          <dt>Instructions</dt>
          <dd>{resourceCounts.instructions}</dd>
        </div>
        <div>
          <dt>MCP servers</dt>
          <dd>{resourceCounts.mcpServers}</dd>
        </div>
      </dl>
    </section>
  );
}
