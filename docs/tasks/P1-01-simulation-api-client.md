# P1-01: Simulation API client + bundle selection

## Goal

Wire the browser to managed simulation: user picks a candidate policy bundle via browse path, calls existing simulate API read-only.

## Spec refs

- SPEC §7.8 (managed simulation)
- SPEC §12.4 M2 (simulate routes)

## Scope IN

- `src/ui/api.ts` — `fetchSimulateManaged` or equivalent
- `src/server/routes/simulate.ts` — verify route exists; UI client only unless gap found
- `src/ui/components/SimulationPanel.tsx` — bundle path picker (reuse project browse pattern from V0-01)

## Scope OUT

- Delta visualization (P1-02)
- New simulation logic in `src/application/simulate.ts`
- Apply/write paths

## Acceptance

- [ ] User selects candidate bundle directory through browse UI
- [ ] `POST /api/simulate/managed` called read-only; errors surfaced
- [ ] Response typed and passed to parent for P1-02

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)
