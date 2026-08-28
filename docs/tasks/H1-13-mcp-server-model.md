# H1-13: McpServer model completeness and probe addressing

## Goal

A discovered MCP server carries the fields §5 requires and can be addressed by its configured name.

## Spec refs

- SPEC §5 (`McpServer`: `definitionKind`, `configHash`, full `status` union)
- SPEC §7.9 (probe UX)
- SPEC §12.5 (`agent-manager probe-mcp <server>`)

## Scope IN

- src/adapters/claude/discovery/types.ts (`DiscoveredMcpServer`)
- src/adapters/claude/discovery/mcp.ts
- src/application/probe-mcp.ts (server lookup)
- src/cli/index.ts, src/server/routes/mcp.ts
- tests/adapters/claude/probing/mcp-probe.test.ts

## Scope OUT

- Probe execution or cache format — H1-15
- Trust status assignment rules — H1-03

## Findings being fixed

`DiscoveredMcpServer` (`discovery/types.ts:19-25`) is `{ id, source, configPath, transport, status }`. Missing versus §5: `name` (the configured server key), `definitionKind` (`inline-agent` | `named-reference` | `config-file`) and `configHash`. `status` admits only `configured | unknown`, not `probed | unavailable | requires_auth | blocked_by_trust`. Because `id` is an opaque sha256 slice (`mcp.ts:20-21`) and the name is discarded, `agent-manager probe-mcp github` on the `basic` fixture fails with `McpServerNotFoundError` — the server is only addressable by hash. Verified by hand against `tests/fixtures/claude/basic/project/.mcp.json`.

## Acceptance

- [ ] `DiscoveredMcpServer` carries `name`, `definitionKind` and `configHash`; `status` matches the §5 union
- [ ] `configHash` is computed by the same key-names-only helper as `probing/mcp-probe.ts:130-140` — no values (invariant 10)
- [ ] `probe-mcp <name>` resolves by configured name; the opaque id keeps working; an ambiguous name across config files reports both candidates rather than picking one
- [ ] `blocked_by_trust` is still assigned only per R1/R5 (M1 acceptance #7 stays green)
- [ ] `basic` fixture golden updated in the same change

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

`configHash` on the discovered server is what §7.9 cache invalidation is specified against; today it exists only inside the probe module.
