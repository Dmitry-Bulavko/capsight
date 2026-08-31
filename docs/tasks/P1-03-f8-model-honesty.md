# P1-03: F8 substitute-model honesty in the delta

## Goal

Simulation delta shows F8 model substitution with `unknown` effective identity when unfounded (H1-29).

## Spec refs

- F8, SPEC §2.4, H1-29

## Scope IN

- `src/application/simulate.ts` — verify honesty (adjust only if still asserts undocumented substitute)
- `src/ui/components/SimulationView.tsx` — model change rows
- `tests/application/simulate.test.ts` or UI tests

## Scope OUT

- Regular effective resolution F8 pairs (already deferred from V1-02)

## Acceptance

- [ ] Substitute model identity shown as `unknown` unless matrix-backed
- [ ] Never asserts a specific substitute without fixture/doc foundation
- [ ] F8 matrix ref visible on model change rows

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)
