interface ScanPanelProps {
  scanning: boolean;
  error: string | null;
  onScan: (projectPath?: string) => void;
  showPrompt?: boolean;
  compact?: boolean;
}

export function ScanPanel({
  scanning,
  error,
  onScan,
  showPrompt = false,
  compact = false,
}: ScanPanelProps) {
  if (compact) {
    return (
      <div className="scan-toolbar">
        {showPrompt && (
          <span className="scan-toolbar-note">No scan yet — scan to discover configuration.</span>
        )}
        <button type="button" disabled={scanning} onClick={() => onScan()}>
          {scanning ? "Scanning…" : "Scan current directory"}
        </button>
        {error && <p className="error-message">{error}</p>}
      </div>
    );
  }

  return (
    <section className="panel scan-panel">
      <h2>Scan project</h2>
      {showPrompt ? (
        <p className="scan-prompt">
          No scan available. Scan the current working directory to discover agents and
          configuration.
        </p>
      ) : (
        <p className="scan-prompt">Rescan to refresh discovery results.</p>
      )}
      <div className="scan-actions">
        <button type="button" disabled={scanning} onClick={() => onScan()}>
          {scanning ? "Scanning…" : "Scan current directory"}
        </button>
      </div>
      {error && <p className="error-message">{error}</p>}
    </section>
  );
}
