# S0-03: PreToolUse hook logging

## Goal

Document PreToolUse hook for logging invoked tools — one-sided observation per SPEC §9.3.

## Spec refs

- SPEC §9.2 #3, §9.3

## Scope IN

- `docs/tasks/S0-03-findings.md`
- `src/adapters/claude/probing/hooks-pretooluse.md`

## Acceptance

- [ ] Payload fields documented (tool_name, etc.)
- [ ] One-sided limitation documented (not-observed ≠ denied)
- [ ] Dev-only example hook

## Done checklist

- [ ] npm run test && npm run typecheck
