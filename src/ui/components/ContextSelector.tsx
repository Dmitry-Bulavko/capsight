import type { Agent, ContextPreset, EffectiveConfiguration } from "../../core/model/index.js";
import {
  CONTEXT_PRESETS,
  DEFAULT_CONTEXT_PRESET,
  DEFAULT_CONTEXT_REASON,
} from "../../core/model/context-presets.js";
import { CapsightSelect } from "./CapsightSelect.js";
import {
  DeclaredEffectivePanel,
  extractForkNotice,
  ForkConfigurationNoticeView,
} from "./DeclaredEffective.js";

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

interface ContextPresetControlProps {
  preset: ContextPreset;
  onPresetChange: (preset: ContextPreset) => void;
  /** Unique prefix for radio `name` when multiple controls appear on one page. */
  namePrefix?: string;
  compact?: boolean;
}

export function ContextPresetControl({
  preset,
  onPresetChange,
  namePrefix = "context-preset",
  compact = false,
}: ContextPresetControlProps) {
  if (compact) {
    const selectId = `${namePrefix}-select`;
    return (
      <div className="context-preset-control-compact-select">
        <label className="context-preset-select-label" htmlFor={selectId}>
          Context
        </label>
        <CapsightSelect
          id={selectId}
          value={preset}
          options={CONTEXT_PRESETS.map((option) => ({
            value: option,
            label: PRESET_LABELS[option],
            sublabel: option,
          }))}
          onChange={(value) => onPresetChange(value as ContextPreset)}
          ariaLabel="Execution context preset"
          className="context-preset-select"
        />
      </div>
    );
  }

  return (
    <div className="context-preset-control">
      <fieldset className="context-presets">
        <legend>Context preset</legend>
        <ul className="preset-options">
          {CONTEXT_PRESETS.map((option) => (
            <li key={option}>
              <label className="preset-option">
                <input
                  type="radio"
                  name={namePrefix}
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
    </div>
  );
}

interface ContextSelectorProps {
  preset: ContextPreset;
  onPresetChange: (preset: ContextPreset) => void;
  unknownRate: number | null;
  loading?: boolean;
  error?: string | null;
  hasSelectedAgent?: boolean;
  effective?: EffectiveConfiguration | null;
  agent?: Agent | null;
  showPresetSelector?: boolean;
  showDeclaredEffective?: boolean;
}

export function ContextSelector({
  preset,
  onPresetChange,
  unknownRate,
  loading = false,
  error = null,
  hasSelectedAgent = true,
  effective = null,
  agent = null,
  showPresetSelector = true,
  showDeclaredEffective = true,
}: ContextSelectorProps) {
  const forkNotice = preset === "fork" && effective ? extractForkNotice(effective) : null;

  return (
    <section className="panel context-selector">
      <h2>Execution context</h2>

      {showPresetSelector && (
        <ContextPresetControl preset={preset} onPresetChange={onPresetChange} />
      )}

      {forkNotice && <ForkConfigurationNoticeView notice={forkNotice} />}

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

      {showDeclaredEffective && hasSelectedAgent && !loading && !error && effective && (
        <DeclaredEffectivePanel effective={effective} agent={agent} />
      )}
    </section>
  );
}
