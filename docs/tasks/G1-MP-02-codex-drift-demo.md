# G1-MP-02: Codex maxVersion drift demo

## Goal

Prove §8.4 scoped version downgrade on Codex: one confident fixture-backed matrix entry with `maxVersion` downgrades above the bound while a neighbor stays confident.

## Spec refs

- SPEC §8.4
- SPEC §11.1–§11.3
- G1-04 / G1-MP-01 pattern

## Scope IN

- `src/adapters/codex/version/matrix.ts` — add `maxVersion` to one fixture-backed confident entry (e.g. `discovery.skills` or `settings.knownKeysOnly`)
- `tests/fixtures/codex/` — new or extended fixture with `version.txt` above max
- `tests/adapters/codex/version/matrix.test.ts`
- `tests/fixtures/run-codex-golden.test.ts` if new fixture

## Scope OUT

- Cursor (G1-MP-01)
- UI
- Claude matrix

## Acceptance

- [x] At fixture version ≤ maxVersion, target rule enforced/supported on golden
- [x] Above maxVersion, scoped downgrade only; neighbor stays confident
- [x] Golden + H1-28 deletion test
- [x] `npm run test` and `npm run typecheck` pass

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.codex/**`
- [x] TASKS.md updated by orchestrator (not implementer)
