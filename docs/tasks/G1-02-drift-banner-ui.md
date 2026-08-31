# G1-02: UI — drift banner + affected answers

## Goal

User sees which answers a version gap affects; no blanket "unsupported".

## Spec refs

- SPEC §8.4, §2.4, invariant 11

## Scope IN

- `src/ui/components/DriftBanner.tsx`
- `src/ui/App.tsx`
- `src/ui/styles.css`
- `tests/ui/drift-banner.test.ts`

## Scope OUT

- Matrix schema changes (G1-01)
- New version detection

## Acceptance

- [ ] Banner appears when detected version outside matrix applicability
- [ ] Lists affected capabilities/rules or count with drill-down
- [ ] Scoped downgrade messaging — not global failure

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)
