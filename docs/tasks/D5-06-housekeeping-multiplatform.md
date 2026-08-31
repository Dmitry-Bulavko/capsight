# D5-06: Matrix housekeeping + multi-platform opportunistic

## Goal

Close matrix consistency debts and promote any remaining low-hanging Cursor/Codex doc-only facts D5-01 marks `promotion-owed`.

## Spec refs

- SPEC §8.2, §11.4
- H1-28

## Scope IN

- `src/adapters/claude/version/matrix.ts` — e.g. `agent.depthLimitDefault` stale `pendingFixture: "version-drift"` (drift demo moved to `agent.tools` in G1-04)
- `src/adapters/cursor/version/matrix.ts` — e.g. CW2 partial
- `src/adapters/codex/version/matrix.ts` — e.g. XA3 doc-only with fixture
- `docs/EVIDENCE-PROMOTION.md`

## Scope OUT

- Claude clusters owned by D5-02…05
- New fixtures unless deletion test requires minimal extension

## Acceptance

- [x] No stale `pendingFixture` pointing at wrong fixture without documented reason
- [x] Cursor/Codex promotion-owed rows from D5-01 promoted or refused
- [x] D4-06 unchanged
- [x] `npm run test` and `npm run typecheck` pass

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project config dirs
- [x] TASKS.md updated by orchestrator (not implementer)
