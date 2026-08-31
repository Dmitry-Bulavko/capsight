# D5-07: D5 gate — fixture-verified floor

## Goal

Fail-closed gate: wave 5 raised fixture-verified count without regressing D4-06; promotion refusals recorded.

## Spec refs

- SPEC §11.4
- D4-06 gate (entry-owed, unverified ceiling)

## Scope IN

- `tests/fixtures/coverage-report.test.ts`
- `docs/EVIDENCE-PROMOTION.md` — measured counts match report
- `docs/ROADMAP.md` coverage baseline (orchestrator updates post-pass)

## Scope OUT

- New promotions (D5-02…06 must be done)

## Acceptance

- [ ] Total fixture-verified ≥ **50** across three platforms (baseline 41) OR handoff documents gate revision with refusal count
- [ ] `entry-owed` = 0, unverified ≤ 18 (D4-06 tests still pass)
- [ ] EVIDENCE-PROMOTION measured counts match `buildCoverageReport`
- [ ] `npm run test` and `npm run typecheck` pass

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] TASKS.md and ROADMAP updated by orchestrator (not implementer)
