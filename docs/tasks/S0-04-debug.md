# S0-04: claude -p --debug parsing

## Goal

Assess debug log parsing as last-resort observation source (low confidence only).

## Spec refs

- SPEC §9.2 #4

## Scope IN

- `docs/tasks/S0-04-findings.md`
- `src/adapters/claude/probing/debug-log-notes.md`

## Acceptance

- [ ] Document approach and risks (non-contract, breaks on releases)
- [ ] Recommendation: use only if S0-01/03 insufficient, confidence low
- [ ] NOT wired to scan

## Done checklist

- [ ] npm run test && npm run typecheck
