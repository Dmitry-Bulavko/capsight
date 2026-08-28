# H1-01: Secret redaction boundary for snapshot output

## Goal

Agent frontmatter values that can carry credentials never leave the discovery layer as raw data — API, CLI and M3 backups receive key names only.

## Spec refs

- SPEC §0.1.8 (secrets: key names only)
- SPEC §12.6 (не логировать: токены, значения переменных окружения, конфигурацию MCP с credentials)
- SPEC §13 invariant 10

## Scope IN

- src/adapters/claude/discovery/agents.ts (`mcpServers`, `hooks`, `unknownFields` capture)
- src/adapters/claude/discovery/snapshot.ts
- src/core/model/index.ts (`AgentConfiguration` shape for the redacted form)
- src/server/routes/project.ts, src/server/routes/agents.ts
- src/cli/index.ts (`scan` output)
- tests/adapters/claude/discovery/agents.test.ts

## Scope OUT

- Probe `commandDisplay` redaction — H1-15
- Any change to `environment/` (already correct: key names only)
- MCP probe cache format (already correct per §7.9)

## Findings being fixed

`discovery/agents.ts:98,103` stores raw `mcpServers` (inline `env: { GITHUB_TOKEN: ... }`), raw `hooks`, and copies every unrecognized key into `unknownFields`. These reach `POST /api/project/scan` (`routes/project.ts:12`), `GET /api/agents` (`routes/agents.ts:115`) and stdout of `agent-manager scan` (`cli/index.ts:118`) verbatim, and are copied into every M3 backup derived from those files.

## Acceptance

- [ ] Inline MCP definitions are reduced to `{ name, transport, commandName, envKeys[], headerKeys[] }` — no values
- [ ] `hooks` is reduced to a structural summary (event names / count), never raw command strings with arguments
- [ ] `unknownFields` retains key names and value *types*, never value contents
- [ ] Fixture with `env: { GITHUB_TOKEN: "ghp_x" }` in an agent file: token string absent from `/api/project/scan`, `/api/agents`, `agent-manager scan` output and from an M3 backup payload
- [ ] `⚠ Unrecognized field — behavior unknown` (§8.2) still shows the field name

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Reference implementation for the correct shape already exists: `probing/mcp-probe.ts:130-140` (`computeMcpConfigHash` hashes only sorted key names) and `environment/index.ts:89`. Mirror that, do not invent a second convention.
