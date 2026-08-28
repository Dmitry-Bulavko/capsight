# M2-04: Description budget

## Goal

Count agent description tokens, warn at 15000 threshold (A10).

## Scope IN

- `src/adapters/claude/discovery/description-budget.ts`
- Wire warnings into scan/snapshot
- Tests

## Acceptance

- [ ] Estimates token count per agent description (chars/4 ok)
- [ ] Warning when total > 15000 with per-agent breakdown
- [ ] category budget

## Done checklist

- [ ] npm run test && npm run typecheck
