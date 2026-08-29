import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export interface CapsightSelectOptionBadge {
  text: string;
  tone: "active" | "invalid" | "ambiguous" | "shadowed" | "unknown" | "neutral";
}

export interface CapsightSelectOption {
  value: string;
  label: string;
  badge?: CapsightSelectOptionBadge;
  ariaLabel?: string;
}

export interface CapsightSelectProps {
  id?: string;
  value: string;
  options: CapsightSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
  emptyLabel?: string;
}

function optionAriaLabel(option: CapsightSelectOption): string {
  if (option.ariaLabel) return option.ariaLabel;
  if (option.badge) return `${option.label} ${option.badge.text}`;
  return option.label;
}

function SelectOptionRow({ option }: { option: CapsightSelectOption }) {
  return (
    <span className="capsight-select-option-row">
      <span className="capsight-select-option-label">{option.label}</span>
      {option.badge && (
        <span className={`status-badge status-${option.badge.tone}`}>{option.badge.text}</span>
      )}
    </span>
  );
}

export function CapsightSelect({
  id: idProp,
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
  className = "",
  emptyLabel = "No options",
}: CapsightSelectProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const listboxId = `${id}-listbox`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const isDisabled = disabled || options.length === 0;
  const selectClassName = ["capsight-select", className].filter(Boolean).join(" ");
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, []);

  const openMenu = useCallback(() => {
    setIsOpen(true);
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [selectedIndex]);

  const selectOption = useCallback(
    (optionValue: string) => {
      onChange(optionValue);
      closeMenu();
    },
    [closeMenu, onChange],
  );

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (wrapperRef.current?.contains(event.target as Node)) return;
      closeMenu();
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [closeMenu, isOpen]);

  const moveHighlight = (direction: 1 | -1) => {
    if (options.length === 0) return;

    setHighlightedIndex((current) => {
      const start = current >= 0 ? current : selectedIndex >= 0 ? selectedIndex : 0;
      const next = (start + direction + options.length) % options.length;
      return next;
    });
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (isDisabled) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!isOpen) {
          openMenu();
        } else {
          moveHighlight(1);
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!isOpen) {
          openMenu();
        } else {
          moveHighlight(-1);
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (isOpen && highlightedIndex >= 0) {
          selectOption(options[highlightedIndex].value);
        } else {
          openMenu();
        }
        break;
      case "Escape":
        if (isOpen) {
          event.preventDefault();
          closeMenu();
        }
        break;
      default:
        break;
    }
  };

  const handleOptionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveHighlight(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveHighlight(-1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        selectOption(options[index].value);
        break;
      case "Escape":
        event.preventDefault();
        closeMenu();
        break;
      default:
        break;
    }
  };

  const emptyOption: CapsightSelectOption = { value: "", label: emptyLabel };

  return (
    <div ref={wrapperRef} className={selectClassName}>
      <button
        type="button"
        id={id}
        className="capsight-select-trigger"
        disabled={isDisabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        onClick={() => {
          if (isDisabled) return;
          if (isOpen) {
            closeMenu();
          } else {
            openMenu();
          }
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <SelectOptionRow option={selectedOption ?? emptyOption} />
      </button>

      {isOpen && !isDisabled && (
        <div
          id={listboxId}
          role="listbox"
          className="capsight-select-menu"
          aria-label={ariaLabel}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isHighlighted = index === highlightedIndex;
            const optionClassName = [
              "capsight-select-option",
              isSelected ? "capsight-select-option--selected" : "",
              isHighlighted ? "capsight-select-option--highlighted" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                aria-label={optionAriaLabel(option)}
                className={optionClassName}
                tabIndex={isHighlighted ? 0 : -1}
                onClick={() => selectOption(option.value)}
                onMouseEnter={() => setHighlightedIndex(index)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
              >
                <SelectOptionRow option={option} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
