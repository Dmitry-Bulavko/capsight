# M1-06: Trust + plugin limitations

## Goal

Apply trust rules R1/R5 and plugin field ineffectiveness F9 in resolution.

## Spec refs

- R1, R5, F9, R4

## Scope IN

- `src/adapters/claude/resolution/trust.ts`
- `src/adapters/claude/resolution/plugin.ts` (F9 ignored fields)
- `tests/adapters/claude/resolution/trust.test.ts`

## Acceptance

- [ ] blocked_by_trust only for project inline MCP (R1) and project agent hooks (R5)
- [ ] NOT applied to .mcp.json servers
- [ ] Plugin agents: hooks/mcpServers/permissionMode marked ineffective (F9)
- [ ] Tests with fixture scenarios

## Done checklist

- [ ] npm run test && npm run typecheck
