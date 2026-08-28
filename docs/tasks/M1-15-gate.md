# M1-15: Correctness gate

## Goal

Formal correctness gate per §11.3 — block confident mismatches vs goldens.

## Scope IN

- `tests/correctness-gate.test.ts`
- `tests/fixtures/coverage-report.ts` — optional coverage counts for CI

## Acceptance

- [ ] Gate fails if any confident capability status differs from expected.json
- [ ] unknown in output is NOT a failure
- [ ] Reports fixture-verified vs documentation-only counts
- [ ] All current fixtures pass gate

## Done checklist

- [ ] npm run test && npm run typecheck
