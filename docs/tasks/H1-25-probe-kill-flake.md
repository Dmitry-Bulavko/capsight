# H1-25: Flaky SIGTERM→SIGKILL escalation test

## Goal

The probe reaping test either passes deterministically or is replaced by one that does.

## Spec refs

- SPEC §9.4 (таймаут и изоляция процесса)
- SPEC §11.3 (correctness gate — a suite that fails at random is a gate nobody trusts)

## Scope IN

- tests/adapters/claude/probing/mcp-probe.test.ts (`escalates SIGTERM to SIGKILL`)
- src/adapters/claude/probing/mcp-probe.ts (`createDefaultProcessSpawner`) if the flake is in the implementation rather than the test

## Scope OUT

- Re-litigating the escalation behaviour itself, which H1-15 established and verified

## Finding

The test asserting that a child ignoring SIGTERM is escalated to SIGKILL failed once with `expected 'SIGTERM' to be 'SIGKILL'` and passed on every other run, including three consecutive clean ones. It spawns a real Node child that installs a no-op SIGTERM handler, then waits out the grace period.

Two candidate causes, and they need distinguishing rather than guessing:

1. **Test timing.** The child may not have installed its handler before the first signal arrives, so it dies on SIGTERM and never reaches the escalation path. That is a test bug — the child should signal readiness before the parent starts the timeout.
2. **Implementation race.** The grace timer may fire against a process that has already been reaped, or the recorded signal may be read before the escalation lands. That would be a real defect in the reaping path, and worth finding: a probe that leaves a stray MCP server running is exactly what §9.4 asks us to prevent.

## Acceptance

- [ ] The cause is identified, and the report says which of the two it was
- [ ] If it is the test: the child signals readiness and the assertion no longer depends on scheduling
- [ ] If it is the implementation: the race is fixed and the fix is covered
- [ ] The test passes across at least 20 consecutive runs of that file
- [ ] No `retry` or timeout inflation used to mask it

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Observed during H1-17, which correctly declined to chase it out of scope. Filed rather than left as folklore: an intermittent failure that everyone learns to re-run is how a suite stops being a gate, which is the failure mode H1-07 existed to fix.

## Orchestrator verification (post-implementation)

**Cause: candidate 1, test timing — and it was reproduced, not guessed.** A standalone harness driving the real spawner showed 0/40 failures on an idle machine but **8/25 under CPU load**, and in every failing run the child's log file was empty: Node had not finished booting, so the SIGTERM handler was not yet installed and the child died on the default disposition without ever reaching escalation. In every run where the handler was installed the recorded signal was SIGKILL, with no counter-examples. That exonerates the reaping path in `mcp-probe.ts` — the grace timer never fired against an already-reaped process.

**Verified independently: 20 consecutive passes of the file under six-way CPU load, 0 failures**, on the same machine and the same load shape that made the old form fail 8 out of 25. Suite 450 passed | 1 todo.

**The fix removes the race rather than widening it.** The child announces `ready` on stdout only after installing its handlers; the test waits for that line and then calls `close()` to trigger termination. The idle timeout is set to 60 s precisely so it is unreachable — the timer stops being the trigger. That is why this is not timeout inflation: the failure mode becomes impossible instead of less likely, which is what the handoff's prohibition was protecting.

A second test covers the timeout path with a child that has no handlers, so it dies on SIGTERM whether or not it has finished booting — that assertion is scheduling-independent too, and escalation coverage is unchanged because `close()` and the timeout call the same `terminate()`.
