# P1-04: Managed-simulation golden fixture extension

## Goal

Extend `managed-simulation` golden to pin simulation delta in expected.json, unknowns included.

## Spec refs

- SPEC §11.1–§11.3

## Scope IN

- `tests/fixtures/claude/managed-simulation/expected.json`
- `tests/fixtures/run-golden.test.ts` or simulate-specific test

## Scope OUT

- UI changes

## Acceptance

- [ ] Golden includes simulate delta section matching API output shape
- [ ] Unknown substitute identities pinned as unknown, not confident values
- [ ] Golden runner passes

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)
