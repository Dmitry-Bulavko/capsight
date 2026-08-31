import { VERSION_MATRIX as CLAUDE_MATRIX } from "../../adapters/claude/version/matrix.js";
import {
  factConfidence as claudeFactConfidence,
  isFactId as isClaudeFactId,
} from "../../adapters/claude/version/facts.js";
import { VERSION_MATRIX as CODEX_MATRIX } from "../../adapters/codex/version/matrix.js";
import {
  factConfidence as codexFactConfidence,
  isFactId as isCodexFactId,
} from "../../adapters/codex/version/facts.js";
import { VERSION_MATRIX as CURSOR_MATRIX } from "../../adapters/cursor/version/matrix.js";
import {
  factConfidence as cursorFactConfidence,
  isFactId as isCursorFactId,
} from "../../adapters/cursor/version/facts.js";
import type {
  ExecutionContext,
  ResolvedCapability,
  ResolutionReason,
  SourceInfo,
} from "../../core/model/index.js";
import type { CapabilityExplain } from "../api.js";

const STATUS_LABELS: Record<ResolvedCapability["status"], string> = {
  available: "Available",
  denied: "Denied",
  preloaded: "Preloaded",
  blocked: "Blocked",
  unknown: "Unknown",
};

const STATUS_ICONS: Record<ResolvedCapability["status"], string> = {
  available: "✓",
  denied: "⊘",
  preloaded: "◉",
  blocked: "⊗",
  unknown: "?",
};

export const ENFORCEMENT_LABELS: Record<ResolvedCapability["enforcement"], string> = {
  enforced: "Enforced",
  advisory: "Advisory",
  unknown: "Unknown",
};

const PRESET_LABELS: Record<ExecutionContext["preset"], string> = {
  "main-session": "Main session",
  "foreground-subagent": "Foreground subagent",
  "background-subagent": "Background subagent",
  fork: "Fork",
  explore: "Explore",
  plan: "Plan",
  teammate: "Teammate",
};

/** UI tier labels aligned with fact registry confidence (§8.1). */
export type EvidenceTier = "fixture" | "doc" | "ext" | "spike" | "unknown";

type MatrixConfidence = "doc" | "fixture" | "runtime-observed";

interface MatrixEntryLike {
  id: string;
  confidence: MatrixConfidence;
}

const MATRIX_ENTRY_BY_ID = new Map<string, MatrixEntryLike>(
  [...CLAUDE_MATRIX, ...CURSOR_MATRIX, ...CODEX_MATRIX].map((entry) => [entry.id, entry]),
);

export function matrixConfidenceToTier(confidence: MatrixConfidence): EvidenceTier {
  switch (confidence) {
    case "fixture":
      return "fixture";
    case "doc":
      return "doc";
    case "runtime-observed":
      return "spike";
  }
}

export function resolveEvidenceTier(matrixRef: string): EvidenceTier {
  const entry = MATRIX_ENTRY_BY_ID.get(matrixRef);
  if (entry) {
    return matrixConfidenceToTier(entry.confidence);
  }

  if (isClaudeFactId(matrixRef)) {
    return claudeFactConfidence(matrixRef);
  }
  if (isCursorFactId(matrixRef)) {
    return cursorFactConfidence(matrixRef);
  }
  if (isCodexFactId(matrixRef)) {
    return codexFactConfidence(matrixRef);
  }

  return "unknown";
}

export function evidenceTierClassName(tier: EvidenceTier): string {
  return `why-evidence-tier why-evidence-tier-${tier}`;
}

function formatContext(context: ExecutionContext): string {
  const label = PRESET_LABELS[context.preset];
  if (context.depth > 0) {
    return `${label} (depth ${context.depth})`;
  }
  return label;
}

function formatSourceLine(source: SourceInfo): string {
  const path = source.path ?? source.scope;
  if (source.fieldPath) {
    return `${path} — ${source.fieldPath}`;
  }
  return path;
}

function factRefsFromReasons(reasons: readonly ResolutionReason[]): string[] {
  const refs = new Set<string>();
  for (const reason of reasons) {
    if (reason.matrixRef) {
      refs.add(reason.matrixRef);
    }
  }
  return [...refs];
}

function deniedByEntries(capability: ResolvedCapability): Array<{
  path: string;
  detail: string;
}> {
  const entries: Array<{ path: string; detail: string }> = [];

  for (const reason of capability.reasons) {
    if (reason.type !== "denied" || !reason.source) {
      continue;
    }
    const path = reason.source.path ?? reason.source.scope;
    const fieldPath = reason.source.fieldPath;
    const detail = fieldPath
      ? `${fieldPath}: ${capability.capabilityId}`
      : capability.capabilityId;
    entries.push({ path, detail });
  }

  return entries;
}

function collectEvidence(capability: ResolvedCapability): string[] {
  const refs = new Set<string>();

  for (const reason of capability.reasons) {
    if (reason.matrixRef) {
      refs.add(reason.matrixRef);
    }
    if (reason.source?.matrixRef) {
      refs.add(reason.source.matrixRef);
    }
  }

  for (const source of capability.sources) {
    if (source.matrixRef) {
      refs.add(source.matrixRef);
    }
  }

  return [...refs];
}

export function EvidenceLine({ matrixRef }: { matrixRef: string }) {
  const tier = resolveEvidenceTier(matrixRef);
  return (
    <span className="why-evidence-line">
      <span className={evidenceTierClassName(tier)}>{tier}</span>
      <code className="why-evidence-ref">{matrixRef}</code>
    </span>
  );
}

interface WhyPanelProps {
  explain: CapabilityExplain | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
}

export function WhyPanel({ explain, loading = false, error = null, onClose }: WhyPanelProps) {
  const capability = explain?.capability;
  const factRefs = capability ? factRefsFromReasons(capability.reasons) : [];
  const deniedBy = capability ? deniedByEntries(capability) : [];
  const evidence = capability ? collectEvidence(capability) : [];

  return (
    <section className="panel why-panel" aria-labelledby="why-panel-title">
      <div className="why-panel-header">
        <h2 id="why-panel-title">Why</h2>
        <button type="button" className="why-panel-close" onClick={onClose}>
          Close
        </button>
      </div>

      {loading && <p className="empty-state">Loading explanation…</p>}

      {!loading && error && <p className="error-message">{error}</p>}

      {!loading && !error && capability && explain && (
        <div className="why-panel-body">
          <p className="why-capability-id mono">{capability.capabilityId}</p>

          <dl className="why-grid">
            <div>
              <dt>Status</dt>
              <dd>
                <span className={`why-status why-status-${capability.status}`}>
                  {STATUS_ICONS[capability.status]} {STATUS_LABELS[capability.status]}
                </span>
              </dd>
            </div>

            <div>
              <dt>Context</dt>
              <dd>{formatContext(explain.context)}</dd>
            </div>

            <div>
              <dt>Enforcement</dt>
              <dd>
                ✓ {ENFORCEMENT_LABELS[capability.enforcement]}
                {factRefs.length > 0 && (
                  <span className="why-enforcement-evidence">
                    {factRefs.map((ref) => (
                      <EvidenceLine key={ref} matrixRef={ref} />
                    ))}
                  </span>
                )}
              </dd>
            </div>
          </dl>

          <section className="why-section">
            <h3>Source of capability</h3>
            <ul className="why-list">
              {capability.sources.map((source, index) => (
                <li key={`${source.path ?? source.scope}-${source.fieldPath ?? index}`}>
                  {formatSourceLine(source)}
                </li>
              ))}
            </ul>
          </section>

          {deniedBy.length > 0 && (
            <section className="why-section">
              <h3>Denied by</h3>
              <ul className="why-denied-list">
                {deniedBy.map((entry, index) => (
                  <li key={`${entry.path}-${index}`}>
                    <span className="mono">{entry.path}</span>
                    <span className="why-denied-detail mono">{entry.detail}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="why-section">
            <h3>Chain</h3>
            <ol className="why-chain">
              {capability.reasons.map((reason, index) => (
                <li key={`${reason.type}-${index}`}>
                  {reason.message}
                  {reason.matrixRef && <EvidenceLine matrixRef={reason.matrixRef} />}
                </li>
              ))}
            </ol>
          </section>

          {evidence.length > 0 && (
            <section className="why-section">
              <h3>Evidence</h3>
              <ul className="why-evidence-list">
                {evidence.map((ref) => (
                  <li key={ref}>
                    <EvidenceLine matrixRef={ref} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </section>
  );
}
