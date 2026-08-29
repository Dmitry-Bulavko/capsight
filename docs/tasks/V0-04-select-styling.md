# V0-04: Custom select + dropdown styling

## Goal

Polished **custom** listbox select for Capsight UI: hover, gap between items, offset from trigger, status badges **inside** trigger and options (not outside).

## Decision (documented)

**Native MDN Customizable `<select>` is abandoned** for Capsight UI.

Browser-verified reasons (Chrome 144, React 19):
- `margin` / `gap` on `::picker(select)` and `<option>` do not produce visible spacing in the open picker
- MDN border pattern still looked cramped; React + native picker unreliable for product polish
- User decision: custom React listbox (`CapsightSelect`) is the supported approach

Reference attempted: [MDN Customizable select](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select) — kept in handoff for history only.

## Scope IN

- `src/ui/components/CapsightSelect.tsx` — custom accessible listbox (button trigger + menu)
- `src/ui/styles.css` — remove native `::picker` / `option` rules; custom select + in-option badges
- `src/ui/components/AgentSelector.tsx` — badges inside select; **remove** external `.agent-selector-status`
- `src/ui/components/ScanPanel.tsx` — platform select (labels only, no badge)
- `tests/ui/capsight-select.test.ts`, `tests/ui/agent-selector.test.ts`
- Delete `src/ui/jsx-custom-elements.d.ts` if unused

## Scope OUT

- Native `<select>` / `selectedcontent` markup
- Scan/resolution logic

## CapsightSelect API

```ts
interface CapsightSelectOptionBadge {
  text: string;
  tone: "active" | "invalid" | "ambiguous" | "shadowed" | "unknown" | "neutral";
}

interface CapsightSelectOption {
  value: string;
  label: string;           // primary text (agent name)
  badge?: CapsightSelectOptionBadge;
  ariaLabel?: string;      // defaults to label + badge text
}
```

Render each row as flex: **label left, status-badge right** (reuse existing `.status-badge.status-*` classes).

Trigger shows selected row the same way (name + badge plate inside the closed control).

## Visual requirements

- Menu: `margin-top: 0.35rem`, `gap: 0.25rem` between items, dark panel, shadow
- Item hover: `#5f6368`; selected item in menu: `#252a38`
- Badge uses existing status colors (`.status-active`, etc.) — small pill inside each row
- Agent selector: **no** badge span outside the select

## Acceptance

- [x] Custom listbox only — no `<select>` in CapsightSelect output
- [x] Agent options show name + status badge **inside** trigger and dropdown rows
- [x] External `agent-selector-status` removed
- [x] Platform select unchanged functionally (no badges)
- [x] Keyboard: Escape, arrows, Enter; click-outside close; ARIA listbox
- [x] Handoff decision recorded (this file)
- [x] Tests + typecheck pass (30 UI tests)
- [x] Browser visual check on localhost:5173

## Done checklist

- [x] `npm run test` (UI) + `npm run typecheck`
- [x] TASKS.md updated by orchestrator
