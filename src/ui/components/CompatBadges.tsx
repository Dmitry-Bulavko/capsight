import { useState } from "react";
import { COMPAT_MATRIX_ENTRIES as CLAUDE_COMPAT } from "../../adapters/claude/version/matrix.js";
import { COMPAT_MATRIX_ENTRIES as CODEX_COMPAT } from "../../adapters/codex/version/matrix.js";
import { COMPAT_MATRIX_ENTRIES as CURSOR_COMPAT } from "../../adapters/cursor/version/matrix.js";
import { PLATFORM_IDS, type PlatformId } from "../../adapters/platform.js";
import {
  mergeCompatEntries,
  type CompatMatrixEntry,
  type CompatSupport,
  type CompatVerdict,
} from "../../core/compat/index.js";
import type { ResourceCompatVerdicts } from "../../server/routes/ecosystem.js";
import { PLATFORM_OPTIONS } from "./ScanPanel.js";

const ALL_COMPAT_ENTRIES = mergeCompatEntries(CLAUDE_COMPAT, CURSOR_COMPAT, CODEX_COMPAT);

const ENTRY_BY_ID = new Map<string, CompatMatrixEntry>(
  ALL_COMPAT_ENTRIES.map((entry) => [entry.id, entry]),
);

const PLATFORM_LABELS: Record<PlatformId, string> = Object.fromEntries(
  PLATFORM_OPTIONS.map((option) => [option.id, option.label]),
) as Record<PlatformId, string>;

export type CompatBadgeState = CompatSupport;

export interface CompatBadgeTrace {
  platform: PlatformId;
  platformLabel: string;
  state: CompatBadgeState;
  matrixRef?: string;
  factRefs: string[];
  trustLabel: string;
  statement: string;
}

/** A founded verdict without a matrix ref must not render as supported or not-supported. */
export function resolveCompatBadgeState(verdict: CompatVerdict): CompatBadgeState {
  if (verdict.support === "unknown") {
    return "unknown";
  }
  if (!verdict.matrixRef) {
    return "unknown";
  }
  return verdict.support;
}

export function formatTrustLabel(confidence: CompatMatrixEntry["confidence"] | undefined): string {
  switch (confidence) {
    case "doc":
      return "[doc]";
    case "runtime-observed":
      return "[spike]";
    case "fixture":
      return "[spike]";
    default:
      return "—";
  }
}

export function buildCompatBadgeTrace(
  platform: PlatformId,
  verdict: CompatVerdict,
): CompatBadgeTrace {
  const state = resolveCompatBadgeState(verdict);
  const entry = verdict.matrixRef ? ENTRY_BY_ID.get(verdict.matrixRef) : undefined;

  return {
    platform,
    platformLabel: PLATFORM_LABELS[platform],
    state,
    matrixRef: verdict.matrixRef,
    factRefs: entry?.factRefs ? [...entry.factRefs] : [],
    trustLabel: formatTrustLabel(entry?.confidence),
    statement: verdict.reason ?? "No compatibility statement is recorded for this resource.",
  };
}

export function compatBadgeAriaLabel(trace: CompatBadgeTrace): string {
  const stateLabel =
    trace.state === "supported"
      ? "consumed"
      : trace.state === "not-supported"
        ? "not consumed"
        : "unknown consumption";
  return `${trace.platformLabel}: ${stateLabel}`;
}

export function compatBadgeTitle(trace: CompatBadgeTrace): string {
  if (trace.state === "unknown") {
    return trace.statement;
  }
  return trace.statement;
}

const FORBIDDEN_BADGE_COPY = /\b(will not work|broken|unsupported capability)\b/i;

export function assertCompatWording(statement: string): void {
  if (FORBIDDEN_BADGE_COPY.test(statement)) {
    throw new Error(`Compat statement uses forbidden wording: ${statement}`);
  }
}

interface CompatBadgesProps {
  compat: ResourceCompatVerdicts;
}

export function CompatBadges({ compat }: CompatBadgesProps) {
  const [activePlatform, setActivePlatform] = useState<PlatformId | null>(null);

  const traces = PLATFORM_IDS.map((platform) =>
    buildCompatBadgeTrace(platform, compat[platform] ?? { support: "unknown", enforcement: "unknown" }),
  );

  const activeTrace = activePlatform
    ? traces.find((trace) => trace.platform === activePlatform)
    : undefined;

  return (
    <div className="compat-badges" data-testid="compat-badges">
      <div className="compat-badge-row" role="group" aria-label="Platform compatibility">
        {traces.map((trace) => (
          <button
            key={trace.platform}
            type="button"
            className={`compat-badge compat-badge-${trace.state}${activePlatform === trace.platform ? " compat-badge-active" : ""}`}
            aria-label={compatBadgeAriaLabel(trace)}
            title={compatBadgeTitle(trace)}
            aria-pressed={activePlatform === trace.platform}
            onClick={() =>
              setActivePlatform((current) => (current === trace.platform ? null : trace.platform))
            }
          >
            <span className="compat-badge-platform">{trace.platform}</span>
            <span className="compat-badge-state" aria-hidden="true">
              {trace.state === "supported" ? "✓" : trace.state === "not-supported" ? "✗" : "?"}
            </span>
          </button>
        ))}
      </div>

      {activeTrace && (
        <div className="compat-badge-trace" data-testid="compat-badge-trace">
          <p className="compat-badge-trace-heading">
            {activeTrace.platformLabel} — {activeTrace.state}
          </p>
          {activeTrace.matrixRef && (
            <p className="compat-badge-trace-line">
              <span className="compat-badge-trace-label">Matrix ref</span>
              <code>{activeTrace.matrixRef}</code>
            </p>
          )}
          {activeTrace.factRefs.length > 0 && (
            <p className="compat-badge-trace-line">
              <span className="compat-badge-trace-label">Fact refs</span>
              <code>{activeTrace.factRefs.join(", ")}</code>
            </p>
          )}
          <p className="compat-badge-trace-line">
            <span className="compat-badge-trace-label">Trust</span>
            <span>{activeTrace.trustLabel}</span>
          </p>
          <p className="compat-badge-trace-statement">{activeTrace.statement}</p>
        </div>
      )}
    </div>
  );
}
