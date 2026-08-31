import type { PlatformId } from "../../adapters/platform.js";
import type { PlanFieldChange, PlanFileChange, PlanResult } from "../../application/plan.js";

export function formatToolList(tools: string[] | undefined): string {
  if (!tools || tools.length === 0) {
    return "(empty)";
  }
  return tools.join(", ");
}

export function hasPlanChanges(plan: PlanResult | null): boolean {
  return (plan?.files.length ?? 0) > 0;
}

export function snapshotStaleWarning(plan: PlanResult | null): string | null {
  const warning = plan?.warnings.find((entry) => entry.code === "snapshot-id-changed");
  return warning?.message ?? null;
}

export function nonClaudePlanReason(platform: PlatformId): string | null {
  if (platform === "claude") {
    return null;
  }
  return `Configuration planning is not supported for platform "${platform}" yet`;
}

interface PlanPreviewProps {
  platform: PlatformId;
  plan: PlanResult | null;
  loading: boolean;
  error: string | null;
  hasPendingEdits: boolean;
}

function FieldChangeRow({ change }: { change: PlanFieldChange }) {
  return (
    <li className="plan-preview-field-change" data-testid="plan-field-change">
      <span className="plan-preview-field-name mono">{change.field}</span>
      <div className="plan-preview-field-values">
        <span className="plan-preview-value plan-preview-value-before">
          <span className="plan-preview-value-label">before</span>
          <code>{formatToolList(change.before)}</code>
        </span>
        <span className="plan-preview-value plan-preview-value-after">
          <span className="plan-preview-value-label">after</span>
          <code>{formatToolList(change.after)}</code>
        </span>
      </div>
    </li>
  );
}

function FileChangeBlock({ file }: { file: PlanFileChange }) {
  return (
    <article className="plan-preview-file" data-testid="plan-file-change">
      <header className="plan-preview-file-header">
        <h3 className="plan-preview-file-path mono">{file.path}</h3>
        <span className="plan-preview-agent-name">{file.agentName}</span>
      </header>
      <ul className="plan-preview-field-list">
        {file.changes.map((change) => (
          <FieldChangeRow key={change.field} change={change} />
        ))}
      </ul>
    </article>
  );
}

export function PlanPreview({
  platform,
  plan,
  loading,
  error,
  hasPendingEdits,
}: PlanPreviewProps) {
  const platformReason = nonClaudePlanReason(platform);
  const staleMessage = snapshotStaleWarning(plan);

  if (!hasPendingEdits) {
    return null;
  }

  return (
    <section className="plan-preview panel" data-testid="plan-preview">
      <h2>Plan preview</h2>
      <p className="plan-preview-note">
        Read-only diff of files and fields that would change. Nothing here writes to disk.
      </p>

      {platformReason && (
        <p className="plan-preview-platform-blocked" data-testid="plan-preview-platform-blocked">
          {platformReason}
        </p>
      )}

      {!platformReason && loading && <p className="empty-state">Computing plan…</p>}

      {!platformReason && error && (
        <p className="error-message" data-testid="plan-preview-error">
          {error}
        </p>
      )}

      {!platformReason && !loading && !error && plan && staleMessage && (
        <p className="plan-preview-stale" data-testid="plan-preview-stale">
          {staleMessage}
          <span className="plan-preview-stale-ids">
            {" "}
            (edit started at <code>{plan.editSnapshotId}</code>, current{" "}
            <code>{plan.snapshotId}</code>)
          </span>
        </p>
      )}

      {!platformReason && !loading && !error && plan && hasPlanChanges(plan) && (
        <div className="plan-preview-files">
          {plan.files.map((file) => (
            <FileChangeBlock key={file.path} file={file} />
          ))}
        </div>
      )}

      {!platformReason && !loading && !error && plan && !hasPlanChanges(plan) && (
        <p className="empty-state">No file changes in the current plan.</p>
      )}

      {!platformReason && !loading && !error && plan && hasPlanChanges(plan) && (
        <p className="plan-preview-cli" data-testid="plan-preview-cli">
          To apply these changes, use the CLI:{" "}
          <code>agent-manager apply --yes --edit-snapshot-id &lt;id&gt; --pending &lt;json&gt;</code>
        </p>
      )}
    </section>
  );
}
