# D4-06: D4 gate — zero entry-owed, unverified ≤ 18

## Goal

Verify D4 phase gate: no `entry-owed` facts remain; total unverified ≤ 18; ledger matches `buildCoverageReport`.

## Spec refs

- SPEC §11.4
- D2-06, D3-05 gates

## Scope IN

- `docs/EVIDENCE-LEDGER.md` — final counts
- `docs/ROADMAP.md` — D4 outcome note (orchestrator may update)
- `tests/fixtures/coverage-report.test.ts` — gate assertions

## Scope OUT

- New matrix entries

## Acceptance

- [ ] `entry-owed` count = 0 across all platforms
- [ ] Total unverified ≤ 18
- [ ] Every remaining unverified fact has terminal ledger disposition
- [ ] D2-06 and D3-05 gates still pass
- [ ] `npm run test` and `npm run typecheck` pass

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] TASKS.md updated by orchestrator (not implementer)
