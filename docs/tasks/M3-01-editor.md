# M3-01: In-memory desired state editor

## Goal

Agent editor UI with pending changes in memory only — no file writes on toggle.

## Spec refs

- SPEC §10 M3 #1, #9

## Scope IN

- `src/ui/components/AgentEditor.tsx`
- `src/ui/state/editor-store.ts` — pending edits in memory
- `src/server/routes/plan.ts` stub or client-only state first

## Acceptance

- [ ] Edit agent tools/checkboxes updates pending state only
- [ ] No filesystem writes on click
- [ ] Shows pending change count
- [ ] npm run test && typecheck

## Done checklist

- [ ] npm run test && npm run typecheck
