# M2-03: Security findings

## Goal

Emit security-finding warnings per §7.6 (skill allowed-tools, Bash guardrail, bypass mode, inline MCP cmd, false allow globs).

## Scope IN

- `src/adapters/claude/resolution/security-findings.ts`
- Wire into resolver.ts
- Tests

## Acceptance

- [ ] Warnings for sensitive skill pre-approval (K6/K7)
- [ ] Bash guardrail when agent has Bash
- [ ] bypassPermissions in agent definition flagged
- [ ] Tests pass

## Done checklist

- [ ] npm run test && npm run typecheck
