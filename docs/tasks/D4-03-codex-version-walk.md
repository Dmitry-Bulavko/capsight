# D4-03: Codex version/walk — matrix entries

## Goal

Close Codex priority-1 version and project-walk facts XV1, XV2, XV3, XR1, XR2 per `docs/EVIDENCE-LEDGER.md`.

## Spec refs

- [CODEX-FACTS.md](../CODEX-FACTS.md)
- SPEC §11.1–§11.4
- H1-28

## Scope IN

- `docs/EVIDENCE-LEDGER.md`
- `src/adapters/codex/version/matrix.ts`
- `tests/fixtures/codex/`
- `tests/fixtures/run-codex-golden.test.ts`
- `tests/fixtures/coverage-report.test.ts`

## Scope OUT

- Codex instructions/trust (D4-04)
- Cursor

## Acceptance

- [ ] Each targeted fact has matrix entry or honest `noFixturePossible`
- [ ] H1-28 on each entry
- [ ] Codex `unverified` drops by facts closed
- [ ] Codex golden runner passes
- [ ] `npm run test` and `npm run typecheck` pass

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)
