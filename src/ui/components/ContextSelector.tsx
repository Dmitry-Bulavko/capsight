import type { ContextPreset } from "../../core/model/index.js";
import {
  CONTEXT_PRESETS,
  DEFAULT_CONTEXT_PRESET,
  DEFAULT_CONTEXT_REASON,
} from "../../core/model/context-presets.js";

/** Re-exported so the UI shares the §4.3 default with the CLI and the API. */
export { CONTEXT_PRESETS, DEFAULT_CONTEXT_PRESET, DEFAULT_CONTEXT_REASON };

const PRESET_LABELS: Record<ContextPreset, string> = {
  "main-session": "Main session",
  "foreground-subagent": "Foreground subagent",
  "background-subagent": "Background subagent",
  fork: "Fork",
  explore: "Explore",
  plan: "Plan",
  teammate: "Teammate",
};

function formatUnknownRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

interface ContextSelectorProps {
  preset: ContextPreset;
  onPresetChange: (preset: ContextPreset) => void;
  unknownRate: number | null;
  loading?: boolean;
  error?: string | null;
  hasSelectedAgent?: boolean;
}

export function ContextSelector({
  preset,
  onPresetChange,
  unknownRate,
  loading = false,
  error = null,
  hasSelectedAgent = true,
}: ContextSelectorProps) {
  return (
    <section className="panel context-selector">
      <h2>Execution context</h2>

      <fieldset className="context-presets">
        <legend>Context preset</legend>
        <ul className="preset-options">
          {CONTEXT_PRESETS.map((option) => (
            <li key={option}>
              <label className="preset-option">
                <input
                  type="radio"
                  name="context-preset"
                  value={option}
                  checked={preset === option}
                  onChange={() => onPresetChange(option)}
                />
                <span className="preset-label">{PRESET_LABELS[option]}</span>
                <code className="preset-id">{option}</code>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <p className="context-default-note">
        <code>{DEFAULT_CONTEXT_PRESET}</code> — {DEFAULT_CONTEXT_REASON}
      </p>

      {hasSelectedAgent && (
        <dl className="summary-grid context-effective">
          <div>
            <dt>Unknown rate</dt>
            <dd>
              {loading && "Loading…"}
              {!loading && error && <span className="error-message">{error}</span>}
              {!loading && !error && unknownRate !== null && (
                <span>{formatUnknownRate(unknownRate)}</span>
              )}
              {!loading && !error && unknownRate === null && "—"}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
