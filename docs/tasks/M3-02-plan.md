# M3-02: Diff planner

## Goal

Compute deterministic file diff from pending editor state.

## Spec refs

- SPEC §10 M3 #2, #3 (snapshot id check)

## Scope IN

- `src/adapters/claude/generation/plan.ts`
- `src/application/plan.ts`
- POST /api/plan
- CLI agent-manager diff
- Tests

## Acceptance

- [x] plan() returns exact files/fields to change
- [x] Warns if ProjectSnapshot.id changed since edit started
- [x] No writes

## Done checklist

- [x] npm run test && npm run typecheck
