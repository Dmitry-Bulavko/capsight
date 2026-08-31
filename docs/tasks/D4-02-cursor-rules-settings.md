# D4-02: Cursor rules/settings — matrix entries

## Goal

Close Cursor `entry-owed` facts CR2, CR3, CSet3 per `docs/EVIDENCE-LEDGER.md`.

## Spec refs

- [CURSOR-FACTS.md](../CURSOR-FACTS.md)
- SPEC §11.1–§11.4
- H1-28

## Scope IN

- `docs/EVIDENCE-LEDGER.md`
- `src/adapters/cursor/version/matrix.ts`
- `tests/fixtures/cursor/`
- `tests/fixtures/run-cursor-golden.test.ts`
- `tests/fixtures/coverage-report.test.ts`

## Scope OUT

- D4-01 facts (already closed)
- Codex

## Acceptance

- [ ] CR2, CR3, CSet3 each have matrix entry or honest `noFixturePossible`
- [ ] H1-28 on each entry
- [ ] Cursor `entry-owed` = 0 after this task
- [ ] `npm run test` and `npm run typecheck` pass

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)
