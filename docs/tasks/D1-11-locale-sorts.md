# D1-11: Locale-independent sorts outside simulate.ts

## Goal

Replace remaining `localeCompare` sorts in write-path and overlay code with locale-independent comparators, matching D1-09/D1-10 fixes elsewhere.

## Spec refs

- SPEC §11.2 (portable goldens)
- D1-10 review finding #4

## Scope IN

- `src/application/managed-overlay.ts` (lines ~281, 335 cited in TASKS)
- `src/application/plan.ts`
- `src/adapters/claude/generation/*` — any locale-sensitive sorts

## Scope OUT

- `simulate.ts` (already fixed in D1-09/D1-10 scope)
- Golden re-records unless a test proves ordering changed (unlikely — not golden-observable)

## Design decisions

Reuse the same `compareStrings` / `sortByKey` pattern from `golden-normalize.ts` or `simulate.ts` — do not introduce a new abstraction unless one already exists in core.

Not golden-observable today: acceptance is code audit + unit test where feasible, not fixture delta.

## Acceptance

- [ ] No bare `.localeCompare` in Scope IN files (grep-verifiable)
- [ ] Sort behaviour documented or covered by a small unit test if easy
- [ ] No behaviour change intended — ordering only becomes locale-independent

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] TASKS.md updated by orchestrator

## Notes

Deferred from D1-10 because no golden observes these lists yet.
