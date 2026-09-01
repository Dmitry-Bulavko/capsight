# UI-A-05: Top nav 8→3 + header cleanup

## Goal

Replace eight top-level dashboard tabs with three contexts and move agent selection out of the global header.

## Spec refs

- SPEC §7.4 (declared inventory vs effective resolution)
- SPEC §8.4 (drift banner on affected answers)

## Scope IN

- `src/ui/components/DashboardNav.tsx` — `ecosystem | agents | simulation` only
- `src/ui/App.tsx` — remove old tab branches; render `AgentsWorkspace` for `agents`
- `src/ui/App.tsx` — remove `AgentSelector` from header
- `src/ui/components/DriftBanner.tsx` — render only inside Agents workspace
- `src/ui/styles.css` — nav cleanup

## Scope OUT

- Ecosystem bridge target (UI-A-06)
- Docs update (UI-A-07)
- New resolver logic

## Design decisions

**Three top tabs:** Ecosystem (declared), Agents (effective workspace), Simulation (unchanged).

**Header:** brand + `ScanPanel` only. No global agent picker.

**DriftBanner:** only when `activeTab === "agents"` (inside workspace chrome).

**Default tab:** `ecosystem` unchanged.

**Delete dead code:** remove conditional renders for `context`, `editor`, `capabilities`, `warnings`, `graph` top-level tabs and old `agents` list tab.

## Acceptance

- [x] Dashboard shows exactly three top-level tabs
- [x] `AgentSelector` is not in the header
- [x] Agents tab opens `AgentsWorkspace` with full sub-view wiring from UI-A-03
- [x] DriftBanner appears only on Agents tab
- [x] Simulation and Ecosystem tabs behave as before
- [x] `npm run test` and `npm run typecheck` pass

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)

## Notes

Branch: `feat/ui-a-agents-workspace`. Largest delete diff in the phase — run full test suite.
