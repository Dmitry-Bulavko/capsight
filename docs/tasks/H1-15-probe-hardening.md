# H1-15: MCP probe hardening

## Goal

The confirmed probe isolates the child process, redacts credential-shaped arguments and does not leave cache entries for failed runs.

## Spec refs

- SPEC §9.4 (безопасность probe: таймаут и изоляция процесса)
- SPEC §7.9 (confirmation text; cache contents)
- SPEC §12.3 (M0–M2: только `cache/`)
- SPEC §13 invariants 9, 10

## Scope IN

- src/adapters/claude/probing/mcp-probe.ts
- tests/adapters/claude/probing/mcp-probe.test.ts

## Scope OUT

- The confirmation gate itself — audited as correct (`mcp-probe.ts:333-335`, `routes/mcp.ts:14` strict `=== true`, CLI `--yes` default false). Do not weaken it.
- Probe cache entry schema, which already matches §7.9 exactly

## Findings being fixed

1. `buildSpawnEnv` (`:150-160`) hands the child the entire `process.env` plus the config `env` block; §9.4 asks for process isolation.
2. `createDefaultProcessSpawner` (`:243-245`) only sends `SIGTERM` on timeout — a child ignoring it is never reaped.
3. `commandDisplay` (`:142-148`) joins command and all args unredacted and returns them in preview and result (`:171`, `:322`), so `--api-key=sk-...` or a token in a URL argument reaches API, UI and the CLI's `console.log` (`cli/index.ts:149`).
4. A failed or timed-out confirmed probe still writes a cache file into the inspected project (`:352-361`, `:395-404`).

## Acceptance

- [ ] Child receives a minimal environment (PATH, HOME and explicitly configured keys), not all of `process.env`
- [ ] Timeout escalates SIGTERM → SIGKILL after a grace period; a test proves the process is reaped
- [ ] Credential-shaped arguments are redacted in `commandDisplay` while the command remains identifiable, satisfying §7.9's "Command: …" requirement without violating invariant 10 — see note
- [ ] Failed / timed-out probes do not write a cache entry, or write one that is explicitly non-authoritative and is not treated as valid by `isMcpProbeCacheValid`
- [ ] Confirmation gate behaviour unchanged; `spawn` still unreachable without confirmation

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Spec tension to resolve deliberately: §7.9 mandates showing `Command: <command> <args>` before running, while §0.1.8 forbids secrets in the UI. Proposed resolution — show the command and argument *shape*, replacing values that match credential patterns with `<redacted>`, and state in the prompt that arguments were redacted. If the orchestrator prefers full fidelity in the confirmation prompt only, record that decision here before implementing.
