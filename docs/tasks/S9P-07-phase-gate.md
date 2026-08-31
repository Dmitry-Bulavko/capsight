# S9P-07: S9P phase gate

## Goal

Fail-closed gate: invocation-only observed layer shipped without regressing D4-06; probe infrastructure documented.

## Spec refs

- SPEC §9.5 (partial path), §11.4, D4-06

## Scope IN

- `tests/fixtures/coverage-report.test.ts` or dedicated gate test
- `docs/S9-DECISION.md` final partial-go status
- ROADMAP coverage note (orchestrator)

## Scope OUT

- New promotions / fv inflation from observations

## Acceptance

- [ ] Gate test: observe CLI not on scan path; D4-06 unchanged
- [ ] S9P deliverables cross-linked in S9-DECISION
- [ ] `entry-owed=0`, unverified ≤18
- [ ] `npm run test` and `npm run typecheck` pass

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] TASKS.md and ROADMAP updated by orchestrator (not implementer)
