import type { ContextPreset } from "../../core/model/index.js";

export const DEFAULT_CONTEXT_PRESET: ContextPreset = "background-subagent";

export const CONTEXT_PRESETS: readonly ContextPreset[] = [
  "main-session",
  "foreground-subagent",
  "background-subagent",
  "fork",
  "explore",
  "plan",
  "teammate",
] as const;

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
        Default preset is <code>{DEFAULT_CONTEXT_PRESET}</code> because it matches the
        actual default mode in interactive sessions when fork mode is enabled (T6).
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
