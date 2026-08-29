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

## Orchestrator verification (post-implementation)

The audit's failing command now works:

```
$ agent-manager probe-mcp github --path tests/fixtures/claude/basic/project
{ "phase": "preview", "serverId": "752032258dde2927", "serverName": "github",
  "message": "This starts the MCP server \"github\" and runs its initialization logic.",
  "commandDisplay": "npx -y @modelcontextprotocol/server-github",
  "requiresConfirmation": true }
```

It resolves by configured name and stops at the confirmation gate with the §7.9 wording — the gate is untouched. Golden diffs are purely additive (`+name`, `+definitionKind`, `+configHash`); `source`, `configPath`, `transport` and `status` are byte-identical, so nothing shifted behaviourally. Suite 331 passed | 1 todo. Accepted.

**One hasher, not two:** `computeMcpConfigHash` moved to discovery and the probe re-exports it, so the key-names-only rule established by H1-01 cannot drift between the two call sites. A test asserts both produce the same hash.

**Ambiguity is reported, not resolved:** the same server name in two config files raises `McpServerAmbiguousError` listing every candidate (HTTP 409), rather than picking one — the same discipline A4 demands of agent collisions.

**`definitionKind` is always `"config-file"` today**, because discovery only reads `.mcp.json`. Inline-agent and named-reference servers are not discovered, and no value was guessed for them. That gap is H1-23-adjacent (inline servers live in agent frontmatter, which H1-01 now redacts) and worth a follow-up once plugin/inline discovery exists.

**`commandDisplay` still shows unredacted argv** — that is H1-15's scope, deliberately untouched here.
