# UI-A-02: Selectable agent list (left panel)

## Goal

Replace the disconnected Agents tab list with a compact, selectable agent list in the Agents workspace left panel.

## Spec refs

- SPEC §7.1 (agent discovery metadata)
- SPEC §10 Acceptance M0 (invalid/shadowed/ambiguous visible)

## Scope IN

- `src/ui/components/AgentList.tsx` — extract or add compact selectable mode
- Optional: `src/ui/components/AgentListPanel.tsx` (new wrapper)
- `src/ui/components/AgentsWorkspace.tsx` — wire left panel
- `src/ui/styles.css` — selection highlight, status badges in list rows
- `tests/ui/` — selection behavior if testable without browser

## Scope OUT

- Declared configuration detail (Overview sub-tab — UI-A-03)
- Removing header `AgentSelector` (UI-A-05)
- Removing old Agents top-level tab (UI-A-05)

## Design decisions

**One selection source:** `selectedAgentId` stays in `App.tsx`. Left panel calls `onAgentSelect(id)`.

**Compact row:** name, scope, status badge, collision indicator when present. Full declared block moves to Overview sub-tab.

**All statuses visible:** invalid, shadowed, ambiguous agents appear in the list; selecting them may show resolver empty states in effective sub-views (existing behavior).

## Acceptance

- [x] Left panel lists all discovered agents with status badges
- [x] Clicking an agent updates `selectedAgentId` and shows visual selection
- [x] Selected agent persists when switching inspector sub-tabs
- [x] Invalid/shadowed/ambiguous agents are selectable with clear status
- [x] `npm run test` and `npm run typecheck` pass

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)

## Notes

Reuse `AgentSelector` badge styling from V0-03 where possible. Branch: `feat/ui-a-agents-workspace`.
