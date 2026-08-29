export const PROJECT_PATH_STORAGE_KEY = "capsight:projectPath";

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadStoredProjectPath(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  const value = storage.getItem(PROJECT_PATH_STORAGE_KEY);
  if (!value?.trim()) return null;
  return value.trim();
}

export function saveStoredProjectPath(path: string): void {
  const storage = getStorage();
  if (!storage) return;
  const trimmed = path.trim();
  if (trimmed) {
    storage.setItem(PROJECT_PATH_STORAGE_KEY, trimmed);
  } else {
    storage.removeItem(PROJECT_PATH_STORAGE_KEY);
  }
}

/** Folder basename for the project button label. */
export function formatProjectFolderLabel(projectPath: string, maxLength = 24): string {
  const trimmed = projectPath.trim();
  if (!trimmed) return "";

  const normalized = trimmed.replace(/[/\\]+$/, "");
  const segments = normalized.split(/[/\\]/);
  const name = segments[segments.length - 1] || normalized;

  if (name.length <= maxLength) return name;
  return `${name.slice(0, maxLength - 1)}…`;
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

function RescanIcon() {
  return (
    <svg className="scan-rescan-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
      />
    </svg>
  );
}

interface ScanPanelProps {
  projectPath: string;
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

function projectButtonLabel(
  projectPath: string,
  browsing: boolean,
  scanning: boolean,
): string {
  if (browsing) return "Browsing…";
  if (scanning) return "Scanning…";
  const folderName = formatProjectFolderLabel(projectPath);
  return folderName || "Browse";
}

export function ScanPanel({
  projectPath,
  onBrowse,
  onRescan,
  onFallbackScan,
  browsing = false,
  scanning,
  browseUnavailable = false,
  fallbackPath,
  onFallbackPathChange,
  error,
}: ScanPanelProps) {
  const busy = scanning || browsing;
  const canRescan = Boolean(projectPath.trim()) && !busy;
  const label = projectButtonLabel(projectPath, browsing, scanning);

  return (
    <div className="scan-toolbar">
      <div className="scan-toolbar-row">
        <button
          type="button"
          className="scan-project-button"
          disabled={busy}
          title={projectPath.trim() || "Choose project folder"}
          onClick={onBrowse}
        >
          <FolderIcon />
          <span className="scan-project-button-label">{label}</span>
        </button>
        <button
          type="button"
          className="scan-rescan-button"
          disabled={!canRescan}
          title="Rescan current project"
          aria-label="Rescan current project"
          onClick={onRescan}
        >
          <RescanIcon />
        </button>
      </div>

      {browseUnavailable && (
        <div className="scan-fallback">
          <p className="scan-fallback-note">
            Folder picker unavailable (headless). Enter path manually or set CAPSIGHT_PROJECT_PATH.
          </p>
          <div className="scan-fallback-row">
            <input
              type="text"
              className="scan-fallback-input"
              value={fallbackPath}
              placeholder="D:\projects\your-project"
              disabled={busy}
              spellCheck={false}
              aria-label="Project path"
              onChange={(event) => onFallbackPathChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !busy && fallbackPath.trim()) {
                  onFallbackScan(fallbackPath);
                }
              }}
            />
            <button
              type="button"
              disabled={busy || !fallbackPath.trim()}
              onClick={() => onFallbackScan(fallbackPath)}
            >
              Scan
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="scan-toolbar-error" title={error}>
          {error}
        </p>
      )}
    </div>
  );
}
