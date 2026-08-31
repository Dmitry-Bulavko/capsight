# D4-05: Codex settings/architecture — matrix entries

## Goal

Close final Codex `entry-owed` facts XA3, XSet1 per `docs/EVIDENCE-LEDGER.md`.

## Spec refs

- [CODEX-FACTS.md](../CODEX-FACTS.md)
- SPEC §11.1–§11.4
- H1-28

## Scope IN

- `docs/EVIDENCE-LEDGER.md`
- `src/adapters/codex/version/matrix.ts`
- `tests/fixtures/codex/`
- `tests/fixtures/coverage-report.test.ts`

## Scope OUT

- D4-04 facts
- Cursor

## Acceptance

- [ ] XA3, XSet1 each closed or honestly refused
- [ ] Codex `entry-owed` = 0 after this task
- [ ] `npm run test` and `npm run typecheck` pass

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)
