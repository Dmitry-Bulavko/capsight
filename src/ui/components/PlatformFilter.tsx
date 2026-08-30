import { PLATFORM_IDS, type PlatformId } from "../../adapters/platform.js";
import type { PlatformDetection } from "../../core/model/ecosystem.js";
import { CapsightSelect, type CapsightSelectOption } from "./CapsightSelect.js";
import { PLATFORM_OPTIONS } from "./ScanPanel.js";

export type PlatformFilterValue = PlatformId | "all";

export const PLATFORM_FILTER_ALL = "all" as const;

const PLATFORM_LABELS: Record<PlatformId, string> = Object.fromEntries(
  PLATFORM_OPTIONS.map((option) => [option.id, option.label]),
) as Record<PlatformId, string>;

export function platformFilterLabel(value: PlatformFilterValue): string {
  if (value === PLATFORM_FILTER_ALL) {
    return "All platforms";
  }
  return PLATFORM_LABELS[value];
}

export function buildPlatformFilterOptions(
  detection: PlatformDetection[],
): CapsightSelectOption[] {
  const statusByPlatform = new Map(detection.map((entry) => [entry.platform, entry.status]));

  const platformOptions: CapsightSelectOption[] = PLATFORM_IDS.map((platform) => {
    const notDetected = statusByPlatform.get(platform) === "not-detected";
    return {
      value: platform,
      label: PLATFORM_LABELS[platform],
      ...(notDetected
        ? {
            badge: { text: "not detected", tone: "unknown" as const },
            ariaLabel: `${PLATFORM_LABELS[platform]} — platform not detected in this project`,
          }
        : {}),
    };
  });

  return [{ value: PLATFORM_FILTER_ALL, label: "All platforms" }, ...platformOptions];
}

interface PlatformFilterProps {
  detection: PlatformDetection[];
  value: PlatformFilterValue;
  onChange: (value: PlatformFilterValue) => void;
  dimmedCount?: number;
  layout?: "stacked" | "inline";
}

export function PlatformFilter({
  detection,
  value,
  onChange,
  dimmedCount = 0,
  layout = "stacked",
}: PlatformFilterProps) {
  const options = buildPlatformFilterOptions(detection);
  const readingLabel = platformFilterLabel(value);
  const className = [
    "platform-filter",
    layout === "inline" ? "platform-filter--inline" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className} data-testid="platform-filter">
      <CapsightSelect
        value={value}
        options={options}
        onChange={(next) => onChange(next as PlatformFilterValue)}
        ariaLabel="Read inventory against platform"
        className="capsight-select--platform-filter"
      />
      {layout === "stacked" && value !== PLATFORM_FILTER_ALL && (
        <p className="platform-filter-summary" data-testid="platform-filter-summary">
          Reading against <strong>{readingLabel}</strong>
          {dimmedCount > 0 && (
            <span className="platform-filter-dimmed-count">
              {` · ${dimmedCount} dimmed (not consumed)`}
            </span>
          )}
        </p>
      )}
      {layout === "inline" && value !== PLATFORM_FILTER_ALL && dimmedCount > 0 && (
        <span className="platform-filter-dimmed-count" data-testid="platform-filter-summary">
          {`${dimmedCount} dimmed`}
        </span>
      )}
    </div>
  );
}
