# D3-03: Claude discovery/builtins — matrix entries

## Goal

Add matrix entries for Claude facts T5, B1, B4 marked `entry-owed` in `docs/EVIDENCE-LEDGER.md`.

## Spec refs

- SPEC §3.3 (T5)
- SPEC §3.9 (B1, B4)
- SPEC §11.1–§11.4
- H1-28

## Scope IN

- `docs/EVIDENCE-LEDGER.md`
- `src/adapters/claude/version/matrix.ts`
- `tests/fixtures/claude/` — tools-filters, background, discovery fixtures
- `tests/fixtures/coverage-report.test.ts`

## Scope OUT

- D3-04 remaining facts
- Cursor/Codex
- UI

## Acceptance

- [x] T5, B1, B4 each have matrix entry or honest `noFixturePossible` with reason
- [x] H1-28 evidence class on each entry
- [x] Claude unverified drops by facts closed
- [x] `npm run test` and `npm run typecheck` pass

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)
