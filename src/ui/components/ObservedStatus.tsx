import type { ObservedCapability, ObservedStatus } from "../../core/observed/index.js";
import { OBSERVED_UI_DISCLAIMER } from "../../core/observed/session.js";

export const OBSERVED_STATUS_LABELS: Record<ObservedStatus, string> = {
  available: "Observed: invoked",
  "not-observed": "Not observed",
  denied: "Observed: denied",
};

export const OBSERVED_FORBIDDEN_LABELS = [
  "Denied",
  "Blocked",
  "Unavailable",
  "Not allowed",
  "Available",
  "Allowed",
] as const;

export function observedStatusClassName(status: ObservedStatus): string {
  return `observed-status-badge observed-status-${status}`;
}

export function formatObservedTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toISOString().slice(0, 10);
}

export function formatObservedEvidenceLine(record: ObservedCapability): string {
  if (record.evidenceKind === "tool-invoked") {
    return `PreToolUse, ${formatObservedTimestamp(record.timestamp)}`;
  }
  if (record.evidenceKind === "permission-denied") {
    return "PermissionDenied, auto-mode";
  }
  return "(no invocation in this session)";
}

export function resolveObservedForCapability(
  capabilityId: string,
  observedById: ReadonlyMap<string, ObservedCapability> | null | undefined,
  sessionActive: boolean,
): ObservedCapability | null {
  if (!sessionActive || !observedById) {
    return null;
  }
  return observedById.get(capabilityId) ?? null;
}

export function resolveObservedStatus(
  capabilityId: string,
  observedById: ReadonlyMap<string, ObservedCapability> | null | undefined,
  sessionActive: boolean,
): ObservedStatus | null {
  if (!sessionActive) {
    return null;
  }
  const record = observedById?.get(capabilityId);
  return record?.observedStatus ?? "not-observed";
}

interface ObservedStatusBadgeProps {
  status: ObservedStatus;
  compact?: boolean;
}

export function ObservedStatusBadge({ status, compact = false }: ObservedStatusBadgeProps) {
  return (
    <span
      className={observedStatusClassName(status)}
      title={OBSERVED_STATUS_LABELS[status]}
      data-testid={`observed-status-badge-${status}`}
    >
      {OBSERVED_STATUS_LABELS[status]}
    </span>
  );
}

interface ObservedDisclaimerProps {
  disclaimer?: string;
}

export function ObservedDisclaimer({ disclaimer }: ObservedDisclaimerProps) {
  return (
    <aside
      className="observed-disclaimer"
      data-testid="observed-disclaimer"
      aria-label="Invocation-only observation disclaimer"
    >
      <p>
        <strong>Invocation-only observation.</strong> Tools are marked observed only when invoked
        or explicitly denied during a dev observation session. <em>Not observed</em> does not mean
        denied. Denied status reflects captured denial events (auto-mode only).
      </p>
      {disclaimer && disclaimer !== OBSERVED_UI_DISCLAIMER && (
        <p className="observed-disclaimer-extra">{disclaimer}</p>
      )}
    </aside>
  );
}

interface ObservedWhySectionProps {
  capabilityId: string;
  observedById: ReadonlyMap<string, ObservedCapability> | null | undefined;
  sessionActive: boolean;
  showDisclaimer?: boolean;
  disclaimer?: string;
}

export function ObservedWhySection({
  capabilityId,
  observedById,
  sessionActive,
  showDisclaimer = true,
  disclaimer,
}: ObservedWhySectionProps) {
  if (!sessionActive) {
    return null;
  }

  const record = resolveObservedForCapability(capabilityId, observedById, sessionActive);
  const status = record?.observedStatus ?? "not-observed";

  return (
    <section className="why-section observed-why-section" data-testid="observed-why-section">
      <h3>Observed</h3>
      <dl className="observed-why-grid">
        <div>
          <dt>Status</dt>
          <dd>
            <ObservedStatusBadge status={status} />
          </dd>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd>
            {status === "available" && record && (
              <span>Invoked during session [{formatObservedEvidenceLine(record)}]</span>
            )}
            {status === "denied" && record && (
              <span>Denied (observed) [{formatObservedEvidenceLine(record)}]</span>
            )}
            {status === "not-observed" && (
              <span>Not observed (no invocation in this session)</span>
            )}
          </dd>
        </div>
      </dl>
      {showDisclaimer && <ObservedDisclaimer disclaimer={disclaimer} />}
    </section>
  );
}
