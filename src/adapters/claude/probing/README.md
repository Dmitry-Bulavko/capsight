# Claude runtime probing (S0 spike)

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

## S0-01 — Agent SDK tool pool

**Script:** `agent-sdk-spike.ts`

**Question:** Does `@anthropic-ai/claude-agent-sdk` expose structural access to the agent's resolved tool pool at runtime?

**Short answer (doc-based, 2026-08-28):** Partial. MCP tools via `mcpServerStatus()`; built-in/deferred names via `getContextUsage()`. No single `supportedTools()` API. Live fixture run still required to confirm field population.

### APIs to try (in probe order)

1. `query().mcpServerStatus()` — per-server `tools[]` with name, description, annotations
2. `query().getContextUsage()` — `mcpTools`, `deferredBuiltinTools`, `systemTools` (context-oriented; some fields optional)
3. `query().initializationResult()` — agents/commands/models; **no tools field**
4. `query().supportedAgents()` — subagent definitions only

### Manual run

```bash
npm install -D @anthropic-ai/claude-agent-sdk   # optional; not in repo deps
npx tsx src/adapters/claude/probing/agent-sdk-spike.ts \
  --fixture tests/fixtures/claude/<fixture>/project
```

Requires Claude Code CLI + API credentials on the developer machine.

### Findings log

| Date | Attempt | Result | Confidence |
|------|---------|--------|------------|
| 2026-08-28 | Official TS SDK docs + npm metadata (`0.3.250`) | Partial introspection; no unified tool-pool API | medium-high (docs) |
| — | Live fixture probe | Not run (spike policy) | — |

Full structured report: [docs/tasks/S0-01-findings.md](../../../docs/tasks/S0-01-findings.md)

## Related S0 tasks

| Task | Script (planned) |
|------|------------------|
| S0-02 SubagentStart hook | TBD |
| S0-03 PreToolUse logging | TBD |
| S0-04 `claude -p --debug` | TBD (last resort, low confidence) |
