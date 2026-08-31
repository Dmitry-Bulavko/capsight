# G1-04: Drift demonstration on a confident rule

## Goal

Prove G1 scoped downgrade on a matrix entry that is **supported/enforced** at the fixture version — not only on `status: "changed"` rules.

## Spec refs

- SPEC §8.4
- SPEC §11.1–§11.3
- ROADMAP G1 outcome note (honest ceiling)

## Scope IN

- `src/adapters/claude/version/matrix.ts` — add `maxVersion` to one otherwise-confident entry (e.g. tool whitelist or disallowedTools)
- `tests/fixtures/claude/` — new fixture or extend existing with version.txt above max
- `tests/fixtures/run-golden.test.ts` — assert neighbor capability stays confident

## Scope OUT

- UI (DriftBanner already reads resolver output)
- Cursor/Codex maxVersion entries

## Acceptance

- [x] At fixture version, target rule resolves enforced/supported on at least one capability
- [x] With version above maxVersion, only that rule downgrades; at least one other rule stays enforced
- [x] Golden + deletion test pin the downgrade
- [x] `npm run test` and `npm run typecheck` pass

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)
