# M2-01: MCP probe with confirmation

## Goal

Explicit MCP probe operation with user confirmation before running server command.

## Spec refs

- SPEC §7.9

## Scope IN

- `src/adapters/claude/probing/mcp-probe.ts`
- `src/application/probe-mcp.ts`
- `src/cli/index.ts` — probe-mcp command
- `src/server/routes/mcp.ts` — POST /api/mcp/:id/probe with confirm flag
- `tests/adapters/claude/probing/mcp-probe.test.ts`

## Acceptance

- [x] Probe requires explicit confirmation (CLI flag --yes or API body confirm:true)
- [x] Shows server command before run
- [x] Does NOT run during normal scan
- [x] Timeout + no secrets in output
- [x] Tests mock child_process

## Done checklist

- [x] npm run test && npm run typecheck
