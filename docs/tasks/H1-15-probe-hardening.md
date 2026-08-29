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

## Orchestrator verification (post-implementation)

Probed a server whose argv carries five different credential shapes:

```
commandDisplay: npx -y @modelcontextprotocol/server-github
                --api-key=<redacted> --token <redacted> --port 8080
                https://user:<redacted>@example.com/mcp?api_key=<redacted>
message:        "...Credential-shaped arguments are shown as <redacted>."
argumentsRedacted: true
```

Grep for every planted secret across the preview returns nothing, while the executable, the package spec, `--port 8080` and the host survive verbatim. The §7.9 requirement to show what you are about to run and the §0.1.8 ban on secrets in the UI are both satisfied — which is what the recorded decision asked for. Suite 361 passed | 1 todo. Accepted.

**Judgement calls accepted:**

1. The `unavailable` branch no longer writes a cache entry either. It was never authoritative — `isMcpProbeCacheValid` requires `status === "probed"` — so it only dropped a permanently-invalid file into the inspected project on every probe.
2. An `error` listener on the child. A spawn failure such as ENOENT previously emitted an unhandled `error` event, which crashes the process; it now resolves as `status: "error"` instead of waiting out the timeout. Strictly a fix.
3. `detached: true` plus signalling the process group, so SIGKILL reaches grandchildren (`npx` → the real server). The kill timers are deliberately not `unref`'d, so delivery is guaranteed within the grace period.

**Stated limit, not a defect:** the bare-token heuristic (length ≥ 24, mixed classes, Shannon ≥ 3.5) is tuned against false positives on package specs and dates, so a short low-entropy secret passed positionally under a non-credential flag name would not be caught. Flag-name, prefix and URL rules cover the realistic cases. This is a heuristic boundary and is documented as one rather than sold as a guarantee — consistent with §2.4's rule about not promising security properties the product does not have.
