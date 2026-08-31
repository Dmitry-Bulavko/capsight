import { useMemo, useState } from "react";
import type {
  ResolvedCapability,
  SourceInfo,
  Warning,
} from "../../core/model/index.js";

export interface DisplayWarning extends Warning {
  agentId?: string;
}

export type WarningScope = "agent" | "all";

export function formatSourceLine(source: SourceInfo): string {
  const path = source.path ?? source.scope;
  if (source.fieldPath) {
    return `${path} — ${source.fieldPath}`;
  }
  return path;
}

export function normalizePathKey(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value.replace(/\\/g, "/");
}

export function pathsMatch(left: string | undefined, right: string | undefined): boolean {
  const normalizedLeft = normalizePathKey(left);
  const normalizedRight = normalizePathKey(right);
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }
  if (normalizedLeft === normalizedRight) {
    return true;
  }
  return normalizedLeft.endsWith(normalizedRight) || normalizedRight.endsWith(normalizedLeft);
}

export function parseHealthWarningFilter(filterId: string): Warning["severity"] | null {
  const match = /^warnings:(info|warning|critical)$/.exec(filterId);
  return match ? (match[1] as Warning["severity"]) : null;
}

export function filterWarningsBySeverity(
  warnings: readonly DisplayWarning[],
  severity: Warning["severity"] | null,
): DisplayWarning[] {
  if (!severity) {
    return [...warnings];
  }
  return warnings.filter((warning) => warning.severity === severity);
}

export function groupWarningsByCategory(
  warnings: readonly DisplayWarning[],
): [string, DisplayWarning[]][] {
  const groups = new Map<string, DisplayWarning[]>();
  for (const warning of warnings) {
    const existing = groups.get(warning.category) ?? [];
    existing.push(warning);
    groups.set(warning.category, existing);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
}

export function shouldCollapseByCategory(
  warnings: readonly DisplayWarning[],
  threshold = 8,
): boolean {
  return warnings.length > threshold;
}

function agentPathsFromCapability(capability: ResolvedCapability): Set<string> {
  const paths = new Set<string>();
  for (const source of capability.sources) {
    const normalized = normalizePathKey(source.path);
    if (normalized) {
      paths.add(normalized);
    }
  }
  for (const reason of capability.reasons) {
    const normalized = normalizePathKey(reason.source?.path);
    if (normalized) {
      paths.add(normalized);
    }
  }
  return paths;
}

function fieldPathRelatesToCapability(
  fieldPath: string,
  capability: ResolvedCapability,
): boolean {
  if (fieldPath.includes("mcpServers") && capability.kind === "mcp_server") {
    return true;
  }
  if (fieldPath.includes("permissionMode") && capability.kind === "permission") {
    return true;
  }
  if (fieldPath.includes("permissions.allow") && capability.kind === "permission") {
    return true;
  }
  if (fieldPath.includes("allowed-tools") && capability.kind === "skill") {
    return true;
  }
  if (
    (fieldPath.includes("tools") || fieldPath.includes("disallowedTools")) &&
    (capability.kind === "tool" || capability.kind === "mcp_tool")
  ) {
    return true;
  }
  if (fieldPath.includes("hooks") && capability.capabilityId === "agent-hooks") {
    return true;
  }
  return false;
}

export function warningRelatesToCapability(
  warning: Warning,
  capability: ResolvedCapability,
): boolean {
  const capabilityPaths = agentPathsFromCapability(capability);

  for (const evidence of warning.evidence) {
    for (const capabilityPath of capabilityPaths) {
      if (pathsMatch(evidence.path, capabilityPath)) {
        if (!evidence.fieldPath) {
          if (capability.kind === "tool" && capability.capabilityId === "Bash") {
            return true;
          }
          if (capability.kind === "tool" && capability.status === "denied") {
            return true;
          }
          continue;
        }
        if (fieldPathRelatesToCapability(evidence.fieldPath, capability)) {
          return true;
        }
        for (const source of capability.sources) {
          if (source.fieldPath && evidence.fieldPath === source.fieldPath) {
            return true;
          }
        }
      }
    }

    if (evidence.fieldPath && fieldPathRelatesToCapability(evidence.fieldPath, capability)) {
      for (const source of capability.sources) {
        if (pathsMatch(evidence.path, source.path)) {
          return true;
        }
      }
    }
  }

  return false;
}

export function capabilityWarningCount(
  capability: ResolvedCapability,
  warnings: readonly Warning[],
): number {
  return warnings.filter((warning) => warningRelatesToCapability(warning, capability)).length;
}

interface WarningsPanelProps {
  warnings: readonly DisplayWarning[];
  scope?: WarningScope;
  agentId?: string | null;
  severityFilter?: Warning["severity"] | null;
  title?: string;
  emptyMessage?: string;
  compact?: boolean;
}

function WarningItem({ warning }: { warning: DisplayWarning }) {
  return (
    <article className={`warnings-item warnings-severity-${warning.severity}`}>
      <header className="warnings-item-header">
        <span className={`warnings-severity-badge severity-${warning.severity}`}>
          {warning.severity}
        </span>
        <span className="warnings-category-badge">{warning.category}</span>
        {warning.agentId && <span className="warnings-agent-id mono">{warning.agentId}</span>}
      </header>
      <p className="warnings-message">{warning.message}</p>
      {warning.evidence.length > 0 && (
        <ul className="warnings-evidence mono">
          {warning.evidence.map((source, index) => (
            <li key={`${source.path ?? source.scope}-${source.fieldPath ?? index}`}>
              {formatSourceLine(source)}
            </li>
          ))}
        </ul>
      )}
      {warning.matrixRef && (
        <p className="warnings-matrix-ref mono">{warning.matrixRef}</p>
      )}
    </article>
  );
}

function WarningGroup({
  category,
  warnings,
  defaultOpen,
}: {
  category: string;
  warnings: DisplayWarning[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (warnings.length === 1) {
    return <WarningItem warning={warnings[0]!} />;
  }

  return (
    <details
      className="warnings-category-group"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="warnings-category-summary">
        <span className="warnings-category-name">{category}</span>
        <span className="warnings-category-count">{warnings.length}</span>
      </summary>
      <div className="warnings-category-items">
        {warnings.map((warning, index) => (
          <WarningItem key={`${warning.message}-${warning.agentId ?? index}`} warning={warning} />
        ))}
      </div>
    </details>
  );
}

export function WarningsPanel({
  warnings,
  scope = "agent",
  agentId = null,
  severityFilter = null,
  title = "Warnings",
  emptyMessage = "No warnings for this view.",
  compact = false,
}: WarningsPanelProps) {
  const filtered = useMemo(
    () => filterWarningsBySeverity(warnings, severityFilter),
    [warnings, severityFilter],
  );
  const collapse = shouldCollapseByCategory(filtered);
  const groups = useMemo(() => groupWarningsByCategory(filtered), [filtered]);

  return (
    <section
      className={`panel warnings-panel${compact ? " warnings-panel-compact" : ""}`}
      data-testid="warnings-panel"
    >
      <header className="warnings-panel-header">
        <h2>{title}</h2>
        <span className="warnings-panel-meta">
          {scope === "agent" && agentId ? (
            <span className="warnings-scope-label mono">{agentId}</span>
          ) : (
            <span className="warnings-scope-label">All active agents</span>
          )}
          <span className="warnings-count">{filtered.length}</span>
        </span>
      </header>

      {filtered.length === 0 ? (
        <p className="empty-state">{emptyMessage}</p>
      ) : collapse ? (
        <div className="warnings-list">
          {groups.map(([category, categoryWarnings]) => (
            <WarningGroup
              key={category}
              category={category}
              warnings={categoryWarnings}
              defaultOpen={groups.length <= 3}
            />
          ))}
        </div>
      ) : (
        <div className="warnings-list">
          {filtered.map((warning, index) => (
            <WarningItem key={`${warning.message}-${warning.agentId ?? index}`} warning={warning} />
          ))}
        </div>
      )}
    </section>
  );
}
