# S0-02: SubagentStart hook payload

## Goal

Document SubagentStart hook JSON payload — does it expose agent tool composition?

## Spec refs

- SPEC §9.2 #2

## Scope IN

- `docs/tasks/S0-02-findings.md`
- `src/adapters/claude/probing/hooks-subagent-start.md` (example hook + notes)

## Scope OUT

- Wiring hooks into scan

## Acceptance

- [ ] Payload fields documented (agent_type and any tool-related fields)
- [ ] Assessment: useful for observed layer yes/no/inconclusive
- [ ] Example hook config documented (dev/test only)

## Done checklist

- [ ] npm run test && npm run typecheck
