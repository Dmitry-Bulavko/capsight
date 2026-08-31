# D3-04: Claude skills/instructions/remaining — matrix entries

## Goal

Close remaining Claude `entry-owed` facts: K7, K9, I4, N1, P3, M4, M5, E9 (if not closed in D3-01).

## Spec refs

- SPEC §3.6, §3.8, §3.10, §3.4, §3.12
- SPEC §11.1–§11.4
- H1-28

## Scope IN

- `docs/EVIDENCE-LEDGER.md`
- `src/adapters/claude/version/matrix.ts`
- `tests/fixtures/claude/` as needed
- `tests/fixtures/coverage-report.test.ts`

## Scope OUT

- Cursor/Codex entry-owed (already closed in D2)
- UI

## Acceptance

- [x] Each remaining Claude entry-owed fact closed or moved to honest refusal
- [x] H1-28 on each entry
- [x] `npm run test` and `npm run typecheck` pass

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)
