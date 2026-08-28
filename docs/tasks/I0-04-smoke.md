# I0-04: Smoke test orchestration handoff

## Goal

Verify the implementer subagent can follow a handoff and deliver a verifiable artifact without touching TASKS/ROADMAP.

## Spec refs

- Plan §5 (workflow)
- Plan §3 (implementer role)

## Scope IN

- tests/orchestration.test.ts
- docs/ORCHESTRATION-SMOKE.md

## Scope OUT

- Product code under src/adapters/
- Updating TASKS.md or ROADMAP.md (orchestrator only)

## Acceptance

- [x] `tests/orchestration.test.ts` asserts existence of orchestration files (ROADMAP, TASKS, template, rules, skill, agent)
- [x] `docs/ORCHESTRATION-SMOKE.md` contains one line: `Handoff workflow verified at I0-04.`
- [x] `npm run test` passes
- [x] `npm run typecheck` passes

## Done checklist

- [x] npm run test
- [x] npm run typecheck
- [x] no writes to scanned project's .claude/**
- [x] TASKS.md updated by orchestrator (not implementer)

## Notes

Orchestrator: this is a meta-task to validate delegation pipeline before M0/S0 work begins.
