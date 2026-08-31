# G1-03: Drift fixture — version above the matrix

## Goal

Golden fixture pins downgrade behaviour when version exceeds matrix range — not a confident answer.

## Spec refs

- SPEC §11.1–§11.3, §8.4

## Scope IN

- `tests/fixtures/claude/version-drift/` — extend or add scenario
- `tests/fixtures/run-golden.test.ts`

## Scope OUT

- UI (G1-02)

## Acceptance

- [ ] Fixture sets version above matrix max for at least one rule
- [ ] Golden expects scoped downgrade, not confident wrong verdict
- [ ] Golden runner passes

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)
