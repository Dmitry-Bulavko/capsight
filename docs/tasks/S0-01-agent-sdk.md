# S0-01: Agent SDK tool pool access

## Goal

Spike whether Claude Agent SDK exposes structural access to an agent's tool pool at runtime.

## Spec refs

- SPEC §9.2 #1 — primary candidate for observed layer
- SPEC §9.4 — safety constraints for probes

## Scope IN

- `src/adapters/claude/probing/README.md` — findings log
- `src/adapters/claude/probing/agent-sdk-spike.ts` — exploratory script (dev-only, not auto-run)
- `docs/tasks/S0-01-findings.md` — structured findings

## Scope OUT

- Production scan integration
- Automatic runtime probe on user projects

## Acceptance

- [ ] Document attempt: SDK API surface searched, what was tried
- [ ] Record: available / not available / inconclusive with evidence
- [ ] Spike script exists but is NOT invoked by normal scan
- [ ] Findings file created at docs/tasks/S0-01-findings.md

## Done checklist

- [ ] npm run test
- [ ] npm run typecheck
