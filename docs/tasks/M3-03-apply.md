# M3-03: Backup, apply, rollback

## Goal

Write path: backup before apply, confirmation, rollback restores files.

## Spec refs

- SPEC §10 M3 #4-8, §12.3 history/backups

## Scope IN

- `src/adapters/claude/generation/apply.ts`
- `src/adapters/claude/generation/rollback.ts`
- `src/application/apply.ts`
- POST /api/apply, POST /api/rollback/:operationId, GET /api/history
- CLI apply, rollback
- Tests with temp dirs

## Acceptance

- [ ] Backup in .agent-manager/backups/ before any mutation
- [ ] Apply writes only planned fields
- [ ] Post-apply message per M3 #5 (no "verified" without observation)
- [ ] Rollback restores from backup
- [ ] Tests pass

## Done checklist

- [ ] npm run test && npm run typecheck
