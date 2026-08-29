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

## Orchestrator verification (post-implementation)

```
$ agent-manager explain Bash --agent <id>
  context.preset: background-subagent
  contextDefault: { preset, reason: "...actual default mode in an interactive session (T6)." }

$ agent-manager explain Bash --agent <id> --context fork
  contextDefault: absent;  enforcement: unknown   (T3)

$ agent-manager explain Bash --agent <id> --context nonsense
  Invalid context preset: nonsense. Expected one of: main-session, foreground-subagent, ...

$ agent-manager warnings --path <settings-permissions fixture>
  ignored-field P4, security-finding P5, security-finding S4 x2
```

The §4.3 caption appears only when the default was applied, an explicit preset changes the verdict, and an unknown preset is rejected rather than silently defaulted. Suite 346 passed | 1 todo. Accepted.

**JSON output accepted over an ASCII Why-panel.** §7.5 describes a UI rendering; every field it names is present in the JSON, and a second ASCII formatter would be free to drift from the web panel. If the boxed layout is wanted at the CLI it should be one shared formatter, not a reimplementation.

**Filed as H1-24:** the HTTP routes default to `main-session` while §4.3 mandates `background-subagent`, so the two surfaces now answer the same question differently — and the API's default is both the wrong one and the most permissive one. The duplicated `CONTEXT_PRESETS` / `PERMISSION_MODES` between CLI and routers is how they drifted; H1-24 covers extracting them.

**Minor, not filed:** `warnings` repeats a settings-level finding once per active agent, so the S4 pair appeared four times across two agents. Accurate per-agent, potentially misleading as a count. Worth deduplicating by evidence when someone next touches that command.
