# M1-03: Tool pool resolution

## Goal

Resolve agent declared tools/disallowedTools per F2, F3; produce ResolvedCapability[] for tools.

## Spec refs

- F2, F3, F4, F11 (Agent/Task alias)

## Scope IN

- `src/adapters/claude/resolution/tools.ts`
- `src/adapters/claude/resolution/index.ts`
- `tests/adapters/claude/resolution/tools.test.ts`

## Acceptance

- [ ] disallowedTools applied first, then tools whitelist against remainder
- [ ] MCP patterns mcp__server, mcp__server__* supported
- [ ] Tool in both lists removed
- [ ] Each capability has >=1 source and >=1 reason
- [ ] Unknown patterns → unknown status not confident deny
- [ ] Tests for basic allow/deny/MCP patterns

## Done checklist

- [ ] npm run test && npm run typecheck
