# S9P probe findings — Agent SDK live harness (S9P-01)

**Date:** 2026-08-31  
**Task:** [S9P-01-live-probe-harness.md](tasks/S9P-01-live-probe-harness.md)  
**Spec:** §9.2, §9.4; [S9-DECISION.md](S9-DECISION.md) criterion 2 infrastructure  
**Fixture:** `tests/fixtures/claude/basic/project`  
**Recorded payload:** `tests/fixtures/probes/agent-sdk/claude-basic.json`

## Provenance

| Field | Value |
|-------|-------|
| Live probe run | **No** — `ANTHROPIC_API_KEY` not available at implementation time |
| Committed payload | **doc-derived-synthetic** (SDK v0.3.252 reference, 2026-08-31) |
| CI validation | Schema + mocked unit tests in `tests/adapters/claude/probing/agent-sdk-spike.test.ts` |

Re-run live probe when credentials are available:

```bash
npm install -D @anthropic-ai/claude-agent-sdk
npx tsx src/adapters/claude/probing/agent-sdk-spike.ts \
  --fixture tests/fixtures/claude/basic/project
```

Save output under `tests/fixtures/probes/agent-sdk/` with `"provenance": "live"` and update this file.

---

## APIs attempted vs populated (claude/basic)

| API | Populated in recording | Notes |
|-----|------------------------|-------|
| `mcpServerStatus()` | **Partial** | `github` server present (`status: pending`); `toolNames: []` while pending — matches MCP SDK guide |
| `getContextUsage()` | **Partial** | `mcpToolNames: []`; `deferredBuiltinToolNames` / `systemToolNames` **absent** (empty arrays) — matches SDK doc caveat |
| `initializationResult()` | **Yes** | `agentNames` includes project agent `backend`; **no tools field** (`hasToolsField: false`) |
| `supportedAgents()` | **Not in payload** | Logged in `notes` only; returns agent defs, not tool pool |
| Stream `system`/`init` `tools[]` | **Placeholder** | Doc-derived wire names (`Read`, `Write`, …); **not live-verified** |

**Overall:** Fragment introspection only. No unified permission-resolved effective pool — consistent with S9-DECISION criterion 1.

---

## Cross-check vs Capsight resolver (`claude/basic`)

Resolver context: `background-subagent` for agent `backend` (see `tests/fixtures/claude/basic/expected.json`).

| Source | Tool-like capabilities observed | Match resolver? |
|--------|--------------------------------|-----------------|
| Resolver (`backend` agent) | `Read`, `Grep` available; others denied via F2 whitelist | Baseline |
| `initStreamTools` (doc-derived) | `Read`, `Write`, `Edit`, `Grep`, `Glob`, `Bash`, `Task`, `WebFetch`, `WebSearch` | **No** — superset; not agent-scoped; not permission-filtered |
| `mcpServerStatus` (doc-derived) | `github` pending, no tool names | **Partial** — resolver lists `mcp-server:.mcp.json` as available; probe shows server not connected |
| `getContextUsage` (doc-derived) | All tool name arrays empty | **No** — does not surface resolver’s `Read`/`Grep` availability |

**Conclusion:** Probe observations **cannot** be naively equated to `resolved` capabilities. Init stream `tools[]` is session-level wire inventory, not per-agent permission resolution. MCP tools require connected server. `getContextUsage` optional fields are often unset.

---

## §9.4 safety checklist

| Rule | Status |
|------|--------|
| Fixture projects only | **Pass** — `--fixture` required |
| Explicit dev/test mode | **Pass** — manual `npx tsx` only |
| No scan wiring | **Pass** — not imported by `adapter.ts` or CLI scan |
| Process timeout | **Pass** — 120s `AbortController` |
| `strictMcpConfig: true` | **Pass** |
| Observations ≠ configuration | **Pass** — payload and tests label provenance |

---

## Gaps / next steps

1. **Live re-record** on developer machine with API key — replace doc-derived placeholder with `"provenance": "live"`.
2. **Cross-version** — repeat on supported Claude Code versions per criterion 2 (not done in S9P-01).
3. **Hook probes** — invocation collector implemented in S9P-05; live re-record still pending (see below).

---

## Hook event payloads (S9P-05)

**Recorded payload:** `tests/fixtures/probes/hooks/claude-basic.json`  
**Collector:** `src/adapters/claude/probing/invocation-collector.ts`  
**Provenance:** doc-derived-synthetic (Claude Code hooks reference, 2026-08-31)

| Hook event | Maps to | Notes |
|------------|---------|-------|
| `PreToolUse` | `available` + `tool-invoked` | `tool_name` is primary capability key |
| `PermissionDenied` | `denied` + `permission-denied` | Auto-mode only; requires explicit `reason` |
| Silence / absence | *(no record)* | Never promotes to `denied` (§9.3) |

Probe log lines may wrap the stdin JSON as `{ capturedAt, raw }` per `hooks-pretooluse.md`. The collector unwraps `raw` and uses `capturedAt` as the observation timestamp.
