import type { ScanStatusSummary } from "../../application/scan-store.js";
import type { PlatformId } from "../../adapters/platform.js";
import { formatVersion } from "../api.js";

export interface ResourceCounts {
  skills: number;
  instructions: number;
  mcpServers: number;
}

const PLATFORM_VERSION_LABELS: Record<PlatformId, string> = {
  claude: "Claude version",
  cursor: "Cursor version",
  codex: "Codex version",
};

function platformVersionLabel(platform: PlatformId): string {
  return PLATFORM_VERSION_LABELS[platform];
}

interface ProjectSummaryProps {
  summary: ScanStatusSummary;
  resourceCounts: ResourceCounts;
}

export function ProjectSummary({ summary, resourceCounts }: ProjectSummaryProps) {
  const { agents } = summary;

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
          <dt>{platformVersionLabel(summary.platform)}</dt>
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
