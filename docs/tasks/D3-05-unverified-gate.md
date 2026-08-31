# D3-05: D3 gate — unverified below 45

## Goal

Verify D3 phase gate: total unverified across platforms below 45; ledger matches `buildCoverageReport`.

## Spec refs

- SPEC §11.4
- D2-06 gate

## Scope IN

- `docs/EVIDENCE-LEDGER.md` — final counts
- `tests/fixtures/coverage-report.test.ts` — gate assertion for unverified < 45
- `docs/ROADMAP.md` — D3 outcome note (orchestrator may update)

## Scope OUT

- New matrix entries (D3-04)
- UI

## Acceptance

- [x] `buildCoverageReport` total unverified < 45
- [x] Every remaining unverified fact has ledger disposition
- [x] D2-06 gate still passes (count cannot rise)
- [x] `npm run test` and `npm run typecheck` pass

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] TASKS.md updated by orchestrator (not implementer)
