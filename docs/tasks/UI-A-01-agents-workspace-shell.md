# UI-A-01: AgentsWorkspace shell + AgentInspectorNav

## Goal

Introduce the master-detail Agents workspace shell and horizontal sub-navigation without removing existing top-level tabs yet.

## Spec refs

- SPEC §7.4 (declared vs effective are two views)
- SPEC §4.3 (execution context presets)

## Scope IN

- `src/ui/components/AgentsWorkspace.tsx` (new)
- `src/ui/components/AgentInspectorNav.tsx` (new)
- `src/ui/styles.css` — `.agents-workspace`, `.agent-inspector-nav`
- `src/ui/App.tsx` — render workspace behind a dev flag or parallel route (optional: mount when `activeTab === "agents"` once UI-A-05 lands; for this task, mount from a temporary entry or alongside existing tabs per orchestrator choice)

## Scope OUT

- Wiring real sub-view content (UI-A-03)
- Removing old top-level tabs (UI-A-05)
- Graph API changes (UI-A-04)

## Design decisions

**Master-detail grid:** left column `minmax(240px, 280px)`, right column flexible. Chrome row above both columns for context preset (placeholder OK in this task).

**Sub-tabs:** `overview | context | capabilities | warnings | graph | editor` — type `AgentInspectorTab`. State lifted to `App.tsx` as `agentInspectorTab`.

**Incremental delivery:** Old tabs (`context`, `capabilities`, etc.) remain functional until UI-A-05. This task only proves the shell composes.

## Acceptance

- [x] `AgentsWorkspace` renders master-detail layout with placeholder left panel and right content area
- [x] `AgentInspectorNav` switches `agentInspectorTab` with visible active state
- [x] CSS grid is responsive (left panel scrolls independently)
- [x] `npm run test` and `npm run typecheck` pass
- [x] No regression to existing tab rendering

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)

## Notes

Branch: `feat/ui-a-agents-workspace`. UI-A-02 fills the left panel; UI-A-03 wires sub-views.
