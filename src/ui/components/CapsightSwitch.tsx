interface CapsightSwitchProps {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  ariaLabel: string;
  pending?: boolean;
}

export function CapsightSwitch({
  checked,
  disabled = false,
  onChange,
  ariaLabel,
  pending = false,
}: CapsightSwitchProps) {
  return (
    <label
      className={`capsight-switch${pending ? " capsight-switch--pending" : ""}${
        disabled ? " capsight-switch--disabled" : ""
      }`}
    >
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={onChange}
      />
      <span className="capsight-switch-track" aria-hidden="true">
        <span className="capsight-switch-thumb" />
      </span>
    </label>
  );
}
