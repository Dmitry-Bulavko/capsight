# UI-A-07: Docs — IA recorded

## Goal

Document the new two-context dashboard IA in project docs and close the UI-A phase gate.

## Spec refs

- SPEC §7.4

## Scope IN

- `docs/UI-SURFACE-PLAN.md` — update tab table and architecture diagram for post-UI-A state
- `docs/ROADMAP.md` — mark UI-A `done`, update Current focus
- `docs/CONTINUATION.md` — next phase placeholder
- `docs/TASKS.md` — mark UI-A-01…UI-A-07 `done` (orchestrator)

## Scope OUT

- Code changes unless docs reveal a gap requiring a follow-up task
- SPEC.md changes (unless orchestrator approves)

## Acceptance

- [x] UI-SURFACE-PLAN describes three top tabs and Agents workspace sub-tabs
- [x] ROADMAP Current focus reflects UI-A completion
- [ ] TASKS.md all UI-A rows `done` (orchestrator)
- [x] Phase gate: browser IA matches documented two-layer model

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Branch: `feat/ui-a-agents-workspace`. Merge to `main` after this task and full green CI.
