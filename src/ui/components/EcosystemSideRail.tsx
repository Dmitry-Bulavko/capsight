import type { ScanStatusSummary } from "../../application/scan-store.js";
import { ProjectSummary, type ResourceCounts } from "./ProjectSummary.js";
import { ScanPanel } from "./ScanPanel.js";

interface EcosystemSideRailProps {
  summary: ScanStatusSummary;
  resourceCounts: ResourceCounts;
  projectPath: string;
  platform: string;
  onPlatformChange: (platform: string) => void;
  onBrowse: () => void;
  onRescan: () => void;
  onFallbackScan: (path: string) => void;
  browsing?: boolean;
  scanning: boolean;
  browseUnavailable?: boolean;
  fallbackPath: string;
  onFallbackPathChange: (path: string) => void;
  error: string | null;
}

export function EcosystemSideRail({
  summary,
  resourceCounts,
  projectPath,
  platform,
  onPlatformChange,
  onBrowse,
  onRescan,
  onFallbackScan,
  browsing = false,
  scanning,
  browseUnavailable = false,
  fallbackPath,
  onFallbackPathChange,
  error,
}: EcosystemSideRailProps) {
  return (
    <aside className="ecosystem-side-rail" aria-label="Scan and project summary">
      <ScanPanel
        projectPath={projectPath}
        platform={platform}
        onPlatformChange={onPlatformChange}
        onBrowse={onBrowse}
        onRescan={onRescan}
        onFallbackScan={onFallbackScan}
        browsing={browsing}
        scanning={scanning}
        browseUnavailable={browseUnavailable}
        fallbackPath={fallbackPath}
        onFallbackPathChange={onFallbackPathChange}
        error={error}
      />
      <ProjectSummary summary={summary} resourceCounts={resourceCounts} variant="stats" />
    </aside>
  );
}
