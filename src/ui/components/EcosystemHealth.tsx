import type {
  EcosystemHealthSummary,
  HealthCountLink,
  HealthFilterId,
  PlatformHealthSection,
} from "../../application/ecosystem-health.js";
import type { Warning } from "../../core/model/index.js";
import {
  filterWarningsBySeverity,
  parseHealthWarningFilter,
  WarningsPanel,
} from "./WarningsPanel.js";

interface EcosystemHealthProps {
  health: EcosystemHealthSummary;
  activeFilterId: HealthFilterId | null;
  onFilterChange: (filterId: HealthFilterId | null) => void;
  snapshotWarnings?: readonly Warning[];
}

function HealthCountButton({
  link,
  activeFilterId,
  onFilterChange,
  isWarningSeverity = false,
}: {
  link: HealthCountLink;
  activeFilterId: HealthFilterId | null;
  onFilterChange: (filterId: HealthFilterId | null) => void;
  isWarningSeverity?: boolean;
}) {
  if (link.count === 0) {
    return null;
  }

  const isActive = activeFilterId === link.id;
  const canFilter = isWarningSeverity || link.resourceIds.length > 0;

  return (
    <button
      type="button"
      className={`ecosystem-health-count${isActive ? " ecosystem-health-count-active" : ""}`}
      disabled={!canFilter}
      aria-pressed={isActive}
      title={
        isWarningSeverity
          ? `Show ${link.count} ${link.label} message${link.count === 1 ? "" : "s"}`
          : canFilter
            ? `Show ${link.count} on canvas`
            : undefined
      }
      onClick={() => {
        if (!canFilter) {
          return;
        }
        onFilterChange(isActive ? null : link.id);
      }}
    >
      <span className="ecosystem-health-count-value">{link.count}</span>
      <span className="ecosystem-health-count-label">{link.label}</span>
    </button>
  );
}

function PlatformHealthSectionView({
  section,
  activeFilterId,
  onFilterChange,
}: {
  section: PlatformHealthSection;
  activeFilterId: HealthFilterId | null;
  onFilterChange: (filterId: HealthFilterId | null) => void;
}) {
  if (!section.detected && section.skills.count === 0 && section.instructions.count === 0) {
    return null;
  }

  const agentLinks = [
    section.agents.active,
    section.agents.invalid,
    section.agents.ambiguous,
    section.agents.shadowed,
  ];

  return (
    <section className="ecosystem-health-platform" aria-label={`${section.platform} health`}>
      <h3 className="ecosystem-health-platform-title">{section.platform}</h3>
      <div className="ecosystem-health-group">
        <span className="ecosystem-health-group-label">Agents</span>
        <div className="ecosystem-health-counts">
          {agentLinks.map((link) => (
            <HealthCountButton
              key={link.id}
              link={link}
              activeFilterId={activeFilterId}
              onFilterChange={onFilterChange}
            />
          ))}
        </div>
      </div>
      <div className="ecosystem-health-group">
        <span className="ecosystem-health-group-label">Resources</span>
        <div className="ecosystem-health-counts">
          <HealthCountButton
            link={section.skills}
            activeFilterId={activeFilterId}
            onFilterChange={onFilterChange}
          />
          <HealthCountButton
            link={section.instructions}
            activeFilterId={activeFilterId}
            onFilterChange={onFilterChange}
          />
          <HealthCountButton
            link={section.mcpNotSupported}
            activeFilterId={activeFilterId}
            onFilterChange={onFilterChange}
          />
          <HealthCountButton
            link={section.mcpUnknown}
            activeFilterId={activeFilterId}
            onFilterChange={onFilterChange}
          />
        </div>
      </div>
    </section>
  );
}

export function EcosystemHealth({
  health,
  activeFilterId,
  onFilterChange,
  snapshotWarnings = [],
}: EcosystemHealthProps) {
  const globalLinks = [
    health.localOverrides,
    health.unresolvedCollisions,
    health.compatUnknown,
    health.warnings.info,
    health.warnings.warning,
    health.warnings.critical,
  ];

  const activeWarningSeverity = activeFilterId
    ? parseHealthWarningFilter(activeFilterId)
    : null;
  const severityFilteredWarnings = filterWarningsBySeverity(
    snapshotWarnings,
    activeWarningSeverity,
  );
  const activeWarningLink =
    activeWarningSeverity === "info"
      ? health.warnings.info
      : activeWarningSeverity === "warning"
        ? health.warnings.warning
        : activeWarningSeverity === "critical"
          ? health.warnings.critical
          : null;

  const hasGlobalCounts = globalLinks.some((link) => link.count > 0);
  const hasPlatformSections = health.platforms.some(
    (section) =>
      section.detected ||
      section.skills.count > 0 ||
      section.instructions.count > 0 ||
      section.agents.active.count > 0,
  );

  return (
    <aside className="ecosystem-health" aria-label="Ecosystem health readout" data-testid="ecosystem-health">
      <header className="ecosystem-health-header">
        <h2 className="ecosystem-health-title">Health</h2>
        {activeFilterId && (
          <button
            type="button"
            className="ecosystem-health-clear"
            onClick={() => onFilterChange(null)}
          >
            Clear filter
          </button>
        )}
      </header>

      {hasGlobalCounts && (
        <section className="ecosystem-health-global" aria-label="Cross-platform conditions">
          <div className="ecosystem-health-counts">
            {globalLinks.map((link) => (
              <HealthCountButton
                key={link.id}
                link={link}
                activeFilterId={activeFilterId}
                onFilterChange={onFilterChange}
                isWarningSeverity={link.id.startsWith("warnings:")}
              />
            ))}
          </div>
          {activeWarningSeverity && activeWarningLink && (
            <WarningsPanel
              warnings={severityFilteredWarnings}
              scope="all"
              severityFilter={activeWarningSeverity}
              title={`${activeWarningLink.label} messages`}
              emptyMessage="No messages for this severity."
              compact
            />
          )}
        </section>
      )}

      {hasPlatformSections &&
        health.platforms.map((section) => (
          <PlatformHealthSectionView
            key={section.platform}
            section={section}
            activeFilterId={activeFilterId}
            onFilterChange={onFilterChange}
          />
        ))}

      {!hasGlobalCounts && !hasPlatformSections && (
        <p className="ecosystem-health-empty">No inventory to summarize yet.</p>
      )}
    </aside>
  );
}
