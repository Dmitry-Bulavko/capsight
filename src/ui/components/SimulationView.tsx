import type { PlatformId } from "../../adapters/platform.js";
import type {
  ManagedSimulationDelta,
  ManagedSimulationResult,
} from "../api.js";
import { ENFORCEMENT_LABELS } from "./WhyPanel.js";
import { formatSourceLine } from "./WarningsPanel.js";
import {
  loadStoredBundlePath,
  SimulationPanel,
} from "./SimulationPanel.js";

export function nonClaudeSimulationReason(platform: PlatformId): string | null {
  if (platform === "claude") {
    return null;
  }
  return `Managed simulation is not supported for platform "${platform}" yet`;
}

export function hasSimulationDelta(delta: ManagedSimulationDelta): boolean {
  return (
    delta.shadowedAgents.length > 0 ||
    delta.deniedTools.length > 0 ||
    delta.ignoredFields.length > 0 ||
    delta.modelChanges.length > 0
  );
}

export function countSimulationDelta(delta: ManagedSimulationDelta): number {
  return (
    delta.shadowedAgents.length +
    delta.deniedTools.length +
    delta.ignoredFields.length +
    delta.modelChanges.length
  );
}

interface SimulationDeltaProps {
  delta: ManagedSimulationDelta;
  bundlePath: string;
}

function SimulationDelta({ delta, bundlePath }: SimulationDeltaProps) {
  if (!hasSimulationDelta(delta)) {
    return (
      <section className="panel simulation-delta" data-testid="simulation-delta">
        <h2>Policy impact</h2>
        <p className="empty-state" data-testid="simulation-delta-empty">
          No policy impact detected for bundle <code>{bundlePath}</code>.
        </p>
      </section>
    );
  }

  return (
    <section className="panel simulation-delta" data-testid="simulation-delta">
      <h2>Policy impact</h2>
      <p className="simulation-delta-note">
        Read-only delta from the managed overlay against the current scan. Nothing here writes to
        disk.
      </p>

      {delta.shadowedAgents.length > 0 && (
        <div className="simulation-delta-section" data-testid="simulation-delta-shadowed">
          <h3>Shadowed agents</h3>
          <ul className="simulation-delta-list">
            {delta.shadowedAgents.map((entry) => (
              <li key={entry.agentId} className="simulation-delta-item">
                <div className="simulation-delta-item-header">
                  <span className="simulation-delta-agent">{entry.agentName}</span>
                  <span className="simulation-delta-status">
                    {entry.previousStatus} → {entry.newStatus}
                  </span>
                </div>
                <p className="simulation-delta-cause">
                  Shadowed by managed agent at{" "}
                  <code>{formatSourceLine(entry.shadowedBy)}</code>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {delta.deniedTools.length > 0 && (
        <div className="simulation-delta-section" data-testid="simulation-delta-denied">
          <h3>Denied tools</h3>
          <ul className="simulation-delta-list">
            {delta.deniedTools.map((entry) => (
              <li
                key={`${entry.agentId}:${entry.capabilityId}`}
                className="simulation-delta-item"
              >
                <div className="simulation-delta-item-header">
                  <span className="simulation-delta-agent">{entry.agentName}</span>
                  <span className="simulation-delta-capability mono">{entry.capabilityId}</span>
                </div>
                <p className="simulation-delta-cause">
                  Was {entry.previousStatus}. {entry.reason}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {delta.ignoredFields.length > 0 && (
        <div className="simulation-delta-section" data-testid="simulation-delta-ignored">
          <h3>Ignored fields</h3>
          <ul className="simulation-delta-list">
            {delta.ignoredFields.map((entry) => (
              <li
                key={`${entry.agentId}:${entry.field}`}
                className="simulation-delta-item simulation-delta-item-warning"
              >
                <div className="simulation-delta-item-header">
                  <span className="simulation-delta-agent">{entry.agentName}</span>
                  <span className="simulation-delta-field mono">{entry.field}</span>
                </div>
                <p className="simulation-delta-cause">{entry.message}</p>
                {entry.evidence.length > 0 && (
                  <ul className="simulation-delta-evidence">
                    {entry.evidence.map((source, index) => (
                      <li key={`${entry.agentId}:${entry.field}:${index}`}>
                        <code>{formatSourceLine(source)}</code>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {delta.modelChanges.length > 0 && (
        <div className="simulation-delta-section" data-testid="simulation-delta-models">
          <h3>Model changes</h3>
          <ul className="simulation-delta-list">
            {delta.modelChanges.map((entry) => (
              <li key={entry.agentId} className="simulation-delta-item">
                <div className="simulation-delta-item-header">
                  <span className="simulation-delta-agent">{entry.agentName}</span>
                  <span className="simulation-delta-model-change">
                    <code>{entry.declared}</code> →{" "}
                    <code>
                      {entry.effectiveEnforcement === "unknown"
                        ? "unknown"
                        : entry.effective}
                    </code>
                  </span>
                </div>
                <p className="simulation-delta-cause">
                  Blocked by allowlist ({entry.matrixRef},{" "}
                  {ENFORCEMENT_LABELS[entry.enforcement]}
                  {entry.enforcementReason ? `: ${entry.enforcementReason}` : ""}). Substitute
                  model identity is {ENFORCEMENT_LABELS[entry.effectiveEnforcement].toLowerCase()}.
                </p>
                <p className="simulation-delta-source">
                  Declared at <code>{formatSourceLine(entry.source)}</code>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export interface SimulationViewProps {
  platform: PlatformId;
  result: ManagedSimulationResult | null;
  onResult: (result: ManagedSimulationResult) => void;
  initialBundlePath?: string;
}

export function SimulationView({
  platform,
  result,
  onResult,
  initialBundlePath,
}: SimulationViewProps) {
  const blockedReason = nonClaudeSimulationReason(platform);
  const bundlePath = initialBundlePath ?? loadStoredBundlePath() ?? "";

  return (
    <div className="tab-simulation" data-testid="simulation-view">
      <SimulationPanel
        blockedReason={blockedReason}
        initialBundlePath={bundlePath}
        onResult={onResult}
      />

      {!blockedReason && !result && (
        <section className="panel simulation-delta-prompt">
          <p className="empty-state" data-testid="simulation-delta-prompt">
            Select a bundle and run Simulate to preview policy impact.
          </p>
        </section>
      )}

      {!blockedReason && result && (
        <SimulationDelta delta={result.delta} bundlePath={result.bundlePath} />
      )}
    </div>
  );
}
