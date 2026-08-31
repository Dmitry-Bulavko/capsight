# Claude runtime probing (S0 / S9P spike)

Exploratory, **dev-only** scripts for SPEC §9 runtime observation. Nothing here is invoked by the ordinary Capsight scan.

## Safety (SPEC §9.4)

| Rule | Enforcement |
|------|-------------|
| Fixture projects only | Pass `--fixture tests/fixtures/claude/<name>/project` |
| Developer/test mode | Manual `npx tsx …` only; no scan integration |
| No auto-run on user projects | Spike modules are not imported by `adapter.ts` or CLI |
| Process isolation + timeout | `agent-sdk-spike.ts` uses `AbortController` + 120s cap |
| No third-party MCP without approval | `strictMcpConfig: true` in spike; fixture-local config only |
| Observations ≠ configuration | All output tagged as observation evidence |

## S9P-01 — Live probe harness + recorded payloads

**Scripts:** `agent-sdk-spike.ts`, `agent-sdk-probe-schema.ts`  
**Findings:** [docs/S9P-PROBE-FINDINGS.md](../../../docs/S9P-PROBE-FINDINGS.md)  
**Recorded fixture:** `tests/fixtures/probes/agent-sdk/claude-basic.json`  
**Tests:** `tests/adapters/claude/probing/agent-sdk-spike.test.ts` (mocked SDK; no live credentials in CI)

### Run protocol (developer machine)

1. Install optional SDK (not a repo dependency):

   ```bash
   npm install -D @anthropic-ai/claude-agent-sdk
   ```

2. Ensure Claude Code CLI and credentials (`ANTHROPIC_API_KEY` or claude.ai auth).

3. Run against a **fixture** project only:

   ```bash
   npx tsx src/adapters/claude/probing/agent-sdk-spike.ts \
     --fixture tests/fixtures/claude/basic/project
   ```

4. Capture stdout JSON. Wrap in recording envelope:

   ```json
   {
     "meta": {
       "fixtureId": "claude/basic",
       "fixturePath": "tests/fixtures/claude/basic/project",
       "recordedAt": "<ISO date>",
       "provenance": "live",
       "sdkVersion": "<npm version>",
       "claudeCodeVersion": "<claude --version>"
     },
     "result": { }
   }
   ```

5. Save to `tests/fixtures/probes/agent-sdk/` and update `docs/S9P-PROBE-FINDINGS.md`.

6. Verify CI-safe tests still pass: `npm run test` (uses committed payload + mocks).

If credentials are unavailable, keep an honest **doc-derived-synthetic** payload (`"provenance": "doc-derived-synthetic"`) — do not label as live.

### APIs probed (in order)

1. `query().mcpServerStatus()` — per-server `tools[]` with name, description, annotations
2. `query().getContextUsage()` — `mcpTools`, `deferredBuiltinTools`, `systemTools` (context-oriented; some fields optional)
3. `query().initializationResult()` — agents/commands/models; **no tools field**
4. `query().supportedAgents()` — subagent definitions only
5. SDK stream — `system`/`init` message `tools: string[]` when emitted (`initStreamTools` in result)

### Findings log

| Date | Attempt | Result | Confidence |
|------|---------|--------|------------|
| 2026-08-28 | Official TS SDK docs + npm metadata (`0.3.250`) | Partial introspection; no unified tool-pool API | medium-high (docs) |
| 2026-08-31 | S9P-01 harness + doc-derived `claude/basic` payload | Infrastructure ready; live probe not run | medium (docs) |
| — | Live fixture probe | Pending developer credentials | — |

Full structured report: [docs/tasks/S0-01-findings.md](../../../docs/tasks/S0-01-findings.md), [docs/S9P-PROBE-FINDINGS.md](../../../docs/S9P-PROBE-FINDINGS.md)

## Related S0 tasks

| Task | Artifact |
|------|----------|
| S0-02 SubagentStart hook | `hooks-subagent-start.md` |
| S0-03 PreToolUse logging | `hooks-pretooluse.md` |
| S0-04 `claude -p --debug` | `debug-log-notes.md` (last resort, low confidence) |
