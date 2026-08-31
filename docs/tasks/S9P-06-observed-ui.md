# S9P-06: UI — one-sided observed status

## Goal

Surface invocation-only observed evidence in browser per S9P-UX-CONTRACT (capabilities or Why panel).

## Spec refs

- SPEC §9.3, §7.5
- S9P-UX-CONTRACT.md

## Scope IN

- `src/ui/` — observed badge/chip with one-sided disclaimer
- API route or mock bridge for observed payload in dev/demo mode
- `tests/ui/observed-status.test.ts`

## Scope OUT

- Structural resolved≠observed warnings
- Scan-path auto observation

## Acceptance

- [ ] UI shows observed status when observation data present
- [ ] One-sided disclaimer visible (not-observed ≠ denied)
- [ ] Visual acceptance in test or component test
- [ ] `npm run test` and `npm run typecheck` pass

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] TASKS.md updated by orchestrator (not implementer)
