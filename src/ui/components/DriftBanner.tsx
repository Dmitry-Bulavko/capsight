import { useMemo, useState } from "react";
import type { PlatformId } from "../../adapters/platform.js";
import { VERSION_MATRIX as CLAUDE_MATRIX } from "../../adapters/claude/version/matrix.js";
import { VERSION_MATRIX as CODEX_MATRIX } from "../../adapters/codex/version/matrix.js";
import { VERSION_MATRIX as CURSOR_MATRIX } from "../../adapters/cursor/version/matrix.js";
import type { EffectiveConfiguration } from "../../core/model/index.js";

const MATRIX_FEATURE_BY_ID = new Map<string, string>(
  [...CLAUDE_MATRIX, ...CURSOR_MATRIX, ...CODEX_MATRIX].map((entry) => [
    entry.id,
    entry.feature,
  ]),
);

const PLATFORM_LABELS: Record<PlatformId, string> = {
  claude: "Claude Code",
  cursor: "Cursor",
  codex: "Codex",
};

/** One resolver answer downgraded because the detected version is outside the matrix entry's applicability. */
export interface AffectedAnswer {
  id: string;
  matrixRef: string;
  featureLabel: string;
  capabilityId?: string;
  message: string;
  source: "capability" | "warning";
}

export function resolveFeatureLabel(matrixRef: string): string {
  return MATRIX_FEATURE_BY_ID.get(matrixRef) ?? matrixRef;
}

export function collectAffectedAnswers(
  effective: EffectiveConfiguration | null | undefined,
): AffectedAnswer[] {
  if (!effective) {
    return [];
  }

  const seen = new Set<string>();
  const results: AffectedAnswer[] = [];

  for (const capability of effective.capabilities) {
    for (const reason of capability.reasons) {
      if (reason.type !== "version" || !reason.matrixRef) {
        continue;
      }
      const key = `capability:${reason.matrixRef}:${capability.capabilityId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      results.push({
        id: key,
        matrixRef: reason.matrixRef,
        featureLabel: resolveFeatureLabel(reason.matrixRef),
        capabilityId: capability.capabilityId,
        message: reason.message,
        source: "capability",
      });
    }
  }

  for (const warning of effective.warnings) {
    if (!warning.matrixRef) {
      continue;
    }
    const versionScoped =
      warning.category === "version" ||
      (warning.enforcement === "unknown" && warning.message.includes("Version matrix"));
    if (!versionScoped) {
      continue;
    }
    const key = `warning:${warning.matrixRef}:${warning.message}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    results.push({
      id: key,
      matrixRef: warning.matrixRef,
      featureLabel: resolveFeatureLabel(warning.matrixRef),
      message: warning.message,
      source: "warning",
    });
  }

  return results.sort((left, right) => {
    const byMatrix = left.matrixRef.localeCompare(right.matrixRef);
    if (byMatrix !== 0) {
      return byMatrix;
    }
    return (left.capabilityId ?? "").localeCompare(right.capabilityId ?? "");
  });
}

export function shouldShowDriftBanner(
  effective: EffectiveConfiguration | null | undefined,
): boolean {
  return collectAffectedAnswers(effective).length > 0;
}

export function formatDriftSummary(
  platform: PlatformId,
  version: string,
  affectedCount: number,
): string {
  const platformLabel = PLATFORM_LABELS[platform];
  const versionLabel = version === "unknown" ? "an undetected version" : `${platformLabel} ${version}`;
  const noun = affectedCount === 1 ? "answer is" : "answers are";
  return `${affectedCount} version-sensitive ${noun} unknown for ${versionLabel}.`;
}

export function shouldCollapseAffectedList(count: number, threshold = 5): boolean {
  return count > threshold;
}

interface DriftBannerProps {
  platform: PlatformId;
  version: string;
  effective: EffectiveConfiguration | null;
  loading?: boolean;
  onSelectCapability?: (capabilityId: string) => void;
}

export function DriftBanner({
  platform,
  version,
  effective,
  loading = false,
  onSelectCapability,
}: DriftBannerProps) {
  const affected = useMemo(() => collectAffectedAnswers(effective), [effective]);
  const [expanded, setExpanded] = useState(false);

  if (loading || !shouldShowDriftBanner(effective)) {
    return null;
  }

  const collapseList = shouldCollapseAffectedList(affected.length);
  const visibleItems = collapseList && !expanded ? affected.slice(0, 3) : affected;
  const hiddenCount = affected.length - visibleItems.length;

  return (
    <section
      className="drift-banner"
      data-testid="drift-banner"
      aria-live="polite"
    >
      <div className="drift-banner-header">
        <p className="drift-banner-summary">
          {formatDriftSummary(platform, version, affected.length)}{" "}
          <span className="drift-banner-scope">
            The scan completed; unaffected capabilities keep their verdicts.
          </span>
        </p>
        {collapseList && (
          <button
            type="button"
            className="drift-banner-toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "Show less" : `Show all ${affected.length}`}
          </button>
        )}
      </div>

      <ul className="drift-banner-list">
        {visibleItems.map((item) => (
          <li key={item.id} className="drift-banner-item">
            <div className="drift-banner-item-heading">
              <code className="drift-banner-matrix-ref">{item.matrixRef}</code>
              <span className="drift-banner-feature">{item.featureLabel}</span>
            </div>
            {item.capabilityId && (
              <p className="drift-banner-capability">
                Affects{" "}
                {onSelectCapability ? (
                  <button
                    type="button"
                    className="drift-banner-capability-link"
                    onClick={() => onSelectCapability(item.capabilityId!)}
                  >
                    {item.capabilityId}
                  </button>
                ) : (
                  <code>{item.capabilityId}</code>
                )}
              </p>
            )}
            <p className="drift-banner-reason">{item.message}</p>
          </li>
        ))}
      </ul>

      {collapseList && !expanded && hiddenCount > 0 && (
        <p className="drift-banner-collapsed-note">
          {hiddenCount} more affected {hiddenCount === 1 ? "answer" : "answers"} — expand to review.
        </p>
      )}
    </section>
  );
}
