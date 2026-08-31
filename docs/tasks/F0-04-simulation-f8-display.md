# F0-04: SimulationView F8 display — single source

## Goal

Remove duplicate F8 honesty logic in SimulationView; display `entry.effective` only (always `unknown` per simulate.ts).

## Spec refs

- F8, H1-29, SPEC §2.4

## Scope IN

- `src/ui/components/SimulationView.tsx`
- `tests/ui/simulation-view.test.ts`

## Acceptance

- [x] Model arrow shows `declared → unknown` from `entry.effective` without branching on `effectiveEnforcement`
- [x] Cause line states substitute identity is unknown — not "enforced" or other enforcement label misuse
- [x] No dead code branch
- [x] `npm run test` and `npm run typecheck` pass

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)
