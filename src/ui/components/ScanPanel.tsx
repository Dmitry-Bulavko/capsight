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
  return value?.trim() ? value : null;
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

interface ScanPanelProps {
  projectPath: string;
  onBrowse: () => void;
  browsing?: boolean;
  scanning: boolean;
  error: string | null;
  compact?: boolean;
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

function ScanControls({
  projectPath,
  onBrowse,
  browsing = false,
  scanning,
}: Pick<ScanPanelProps, "projectPath" | "onBrowse" | "browsing" | "scanning">) {
  const label = projectButtonLabel(projectPath, browsing, scanning);

  return (
    <button
      type="button"
      className="scan-project-button"
      disabled={scanning || browsing}
      title={projectPath.trim() || "Choose project folder"}
      onClick={onBrowse}
    >
      <FolderIcon />
      <span className="scan-project-button-label">{label}</span>
    </button>
  );
}

export function ScanPanel({
  projectPath,
  onBrowse,
  browsing = false,
  scanning,
  error,
  compact = false,
}: ScanPanelProps) {
  if (compact) {
    return (
      <div className="scan-toolbar">
        <ScanControls
          projectPath={projectPath}
          onBrowse={onBrowse}
          browsing={browsing}
          scanning={scanning}
        />
        {error && <span className="scan-toolbar-error">{error}</span>}
      </div>
    );
  }

  return (
    <section className="panel scan-panel">
      <h2>Scan project</h2>
      <div className="scan-actions">
        <ScanControls
          projectPath={projectPath}
          onBrowse={onBrowse}
          browsing={browsing}
          scanning={scanning}
        />
      </div>
      {error && <p className="error-message">{error}</p>}
    </section>
  );
}
