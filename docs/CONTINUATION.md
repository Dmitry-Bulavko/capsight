# Capsight continuation

**Active phase:** none — UI-A complete  
**Branch:** `feat/ui-a-agents-workspace` (ready for merge)  
**Last completed:** UI-A — Agent Workspace (IA restructure)

## UI-A outcome

- Dashboard: **Ecosystem | Agents | Simulation** (was 8 tabs)
- Agents workspace: master-detail with Overview, Context, Capabilities, Warnings, Graph (per-agent), Editor
- Ecosystem bridge lands in Agents workspace; DriftBanner scoped to Agents tab
- Graph API: optional `?agent=` for per-agent subgraph

## Evidence ceiling

| metric | value |
|--------|-------|
| fixture-verified | **42 / 145** |
| unverified | **18** (terminal without structural §9) |
| entry-owed | **0** |

## Orchestration

UI-A-01…UI-A-07 complete. Merge `feat/ui-a-agents-workspace` when ready.
