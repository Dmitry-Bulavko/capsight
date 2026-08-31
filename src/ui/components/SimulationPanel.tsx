import { useCallback, useState } from "react";
import {
  browseProjectFolder,
  fetchSimulateManaged,
  type ManagedSimulationResult,
} from "../api.js";
import { formatProjectFolderLabel } from "./ScanPanel.js";

export const BUNDLE_PATH_STORAGE_KEY = "capsight:managedBundlePath";

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadStoredBundlePath(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  const value = storage.getItem(BUNDLE_PATH_STORAGE_KEY);
  if (!value?.trim()) return null;
  return value.trim();
}

export function saveStoredBundlePath(path: string): void {
  const storage = getStorage();
  if (!storage) return;
  const trimmed = path.trim();
  if (trimmed) {
    storage.setItem(BUNDLE_PATH_STORAGE_KEY, trimmed);
  } else {
    storage.removeItem(BUNDLE_PATH_STORAGE_KEY);
  }
}

function FolderIcon() {
  return (
    <svg className="scan-folder-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M1.5 3.25A1.25 1.25 0 0 1 2.75 2h3.086a1.25 1.25 0 0 1 .884.366L7.72 3.25h5.53A1.25 1.25 0 0 1 14.5 4.5v8.25A1.25 1.25 0 0 1 13.25 14H2.75A1.25 1.25 0 0 1 1.5 12.75V3.25Zm1.25-.5a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V4.5a.25.25 0 0 0-.25-.25H7.47l-1.3-1.3a.25.25 0 0 0-.177-.073H2.75a.25.25 0 0 0-.25.25Z"
      />
    </svg>
  );
}

function bundleButtonLabel(
  bundlePath: string,
  browsing: boolean,
  simulating: boolean,
): string {
  if (browsing) return "Browsing…";
  if (simulating) return "Simulating…";
  const folderName = formatProjectFolderLabel(bundlePath);
  return folderName || "Browse bundle";
}

export interface SimulationPanelProps {
  /** When set, bundle selection and simulation are disabled. */
  blockedReason?: string | null;
  initialBundlePath?: string;
  onResult: (result: ManagedSimulationResult) => void;
}

export function SimulationPanel({
  blockedReason = null,
  initialBundlePath = "",
  onResult,
}: SimulationPanelProps) {
  const [bundlePath, setBundlePath] = useState(initialBundlePath);
  const [fallbackPath, setFallbackPath] = useState(initialBundlePath);
  const [browsing, setBrowsing] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [browseUnavailable, setBrowseUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = browsing || simulating;
  const canSimulate = Boolean(bundlePath.trim()) && !busy && !blockedReason;
  const label = bundleButtonLabel(bundlePath, browsing, simulating);

  const runSimulation = useCallback(
    async (path: string) => {
      const trimmed = path.trim();
      if (!trimmed || blockedReason) return;

      setSimulating(true);
      setError(null);
      try {
        const result = await fetchSimulateManaged(trimmed);
        setBundlePath(trimmed);
        setFallbackPath(trimmed);
        saveStoredBundlePath(trimmed);
        onResult(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Simulation failed");
      } finally {
        setSimulating(false);
      }
    },
    [blockedReason, onResult],
  );

  const handleBrowse = useCallback(async () => {
    if (blockedReason) return;

    setBrowsing(true);
    setError(null);
    try {
      const result = await browseProjectFolder();
      if (!result.cancelled) {
        setBrowseUnavailable(false);
        setBundlePath(result.path);
        setFallbackPath(result.path);
        saveStoredBundlePath(result.path);
        return;
      }

      if (result.reason === "unavailable") {
        setBrowseUnavailable(true);
        setError(
          "Folder picker is unavailable on this machine. Enter a bundle path below.",
        );
        return;
      }

      if (result.reason === "busy") {
        setError("Folder picker is already open.");
        return;
      }

      if (result.reason === "timeout") {
        setError("Folder picker timed out. Try again or enter a path manually.");
        setBrowseUnavailable(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Browse failed");
    } finally {
      setBrowsing(false);
    }
  }, [blockedReason]);

  const handleFallbackApply = useCallback(() => {
    const trimmed = fallbackPath.trim();
    if (!trimmed || busy) return;
    setBundlePath(trimmed);
    saveStoredBundlePath(trimmed);
  }, [busy, fallbackPath]);

  return (
    <section className="panel simulation-panel" data-testid="simulation-panel">
      <h2>Managed simulation</h2>
      <p className="plan-preview-note">
        Pick a candidate policy bundle directory, then run a read-only simulation against the
        current scan.
      </p>

      {blockedReason && (
        <p className="plan-preview-platform-blocked" data-testid="simulation-panel-blocked">
          {blockedReason}
        </p>
      )}

      <div className="scan-toolbar">
        <div className="scan-toolbar-row">
          <button
            type="button"
            className="scan-project-button"
            disabled={busy || Boolean(blockedReason)}
            title={bundlePath.trim() || "Choose candidate bundle directory"}
            onClick={() => void handleBrowse()}
          >
            <FolderIcon />
            <span className="scan-project-button-label">{label}</span>
          </button>
          <button
            type="button"
            className="scan-project-button"
            disabled={!canSimulate}
            onClick={() => void runSimulation(bundlePath)}
          >
            Simulate
          </button>
        </div>

        {browseUnavailable && (
          <div className="scan-fallback">
            <p className="scan-fallback-note">
              Folder picker unavailable (headless). Enter the bundle path manually.
            </p>
            <div className="scan-fallback-row">
              <input
                type="text"
                className="scan-fallback-input"
                value={fallbackPath}
                placeholder="D:\policy\candidate-bundle"
                disabled={busy || Boolean(blockedReason)}
                spellCheck={false}
                aria-label="Managed bundle path"
                onChange={(event) => setFallbackPath(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !busy && fallbackPath.trim()) {
                    handleFallbackApply();
                  }
                }}
              />
              <button
                type="button"
                disabled={busy || Boolean(blockedReason) || !fallbackPath.trim()}
                onClick={handleFallbackApply}
              >
                Use path
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="scan-toolbar-error" data-testid="simulation-panel-error" title={error}>
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
