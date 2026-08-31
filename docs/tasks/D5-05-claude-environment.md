# D5-05: Claude environment promotion

## Goal

Promote environment-driven facts from documentation-only to fixture-verified where D5-01 marks `promotion-owed`.

## Spec refs

- SPEC §3.11 (E1–E9)
- SPEC §3.9 (B5, B6)
- SPEC §3.10 (N3, N4)
- H1-28

## Scope IN

- `src/adapters/claude/version/matrix.ts` — environment/builtin entries
- `tests/fixtures/claude/environment/`, `depth-limit/`
- Discovery/resolver if golden channel insufficient (minimal)

## Scope OUT

- Runtime env observation (§9)
- Cursor/Codex env facts

## Expected candidates (confirm via D5-01)

E1, E2, E3, E4, E5, E6, E7, E8, E9, B5, B6, N3, N4 — currently doc-only via `discovery.environment` partial pins.

**Risk:** D3-01 promoted entries at doc confidence because fixture pins discovery output keys, not resolution deltas. Task may end with most rows `promotion-refused` if no §11.2 channel exists — that is success if recorded.

## Acceptance

- [x] Each promotion-owed env fact promoted with deletion test OR refused with specific channel gap
- [x] No invented env/runtime semantics
- [x] D4-06 unchanged
- [x] `npm run test` and `npm run typecheck` pass

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)
