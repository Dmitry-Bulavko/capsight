# D4-04: Codex instructions/trust — matrix entries

## Goal

Close Codex facts XI3, XI4, XA1, XT3 per `docs/EVIDENCE-LEDGER.md`.

## Spec refs

- [CODEX-FACTS.md](../CODEX-FACTS.md)
- SPEC §11.1–§11.4
- H1-28

## Scope IN

- `docs/EVIDENCE-LEDGER.md`
- `src/adapters/codex/version/matrix.ts`
- `src/adapters/codex/` resolver/discovery as needed
- `tests/fixtures/codex/`
- `tests/fixtures/coverage-report.test.ts`

## Scope OUT

- D4-03 facts
- D4-05 (XA3, XSet1)

## Acceptance

- [ ] XI3, XI4, XA1, XT3 each closed or honestly refused
- [ ] H1-28 on each entry
- [ ] `npm run test` and `npm run typecheck` pass

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)
