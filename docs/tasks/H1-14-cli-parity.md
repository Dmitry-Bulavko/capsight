# H1-14: CLI parity with §12.5

## Goal

`explain` and `warnings` exist as CLI commands, matching the API surface that already implements them.

## Spec refs

- SPEC §12.5 (CLI command list)
- SPEC §7.5 (Why panel content)
- SPEC §7.6 (security findings)

## Scope IN

- src/cli/index.ts
- tests/cli/commands.test.ts

## Scope OUT

- `agent-manager observe --fixture` — belongs to the S0 observed layer, which the S0 decision excluded from v0.1 (§9.5)
- New resolver capability; both commands wrap existing application services

## Findings being fixed

`agent-manager --help` lists `scan`, `status`, `agents`, `probe-mcp`, `simulate`, `diff`, `apply`, `rollback`. Missing versus §12.5: `explain <capability> --agent <id> --context <preset>` and `warnings`. Both are already served over HTTP (`routes/agents.ts:125` `/:id/explain`, `index.ts:30` `/api/warnings`), so this is wiring, not new logic.

## Acceptance

- [ ] `agent-manager explain <capability> --agent <id> --context <preset>` prints the §7.5 chain: status, context, enforcement, source of capability, denied-by, chain, evidence
- [ ] `agent-manager warnings` prints the warning list with category, severity, evidence and `matrixRef`
- [ ] `--context` accepts every §4.3 preset and defaults to `background-subagent` with the reason printed alongside (§4.3 requires the caption explaining the default)
- [ ] Output shape matches the corresponding API response so both surfaces stay consistent
- [ ] Both commands are read-only

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

If the observed layer is ever revisited (§9.5), `observe --fixture` gets its own task then — do not add a stub now.
