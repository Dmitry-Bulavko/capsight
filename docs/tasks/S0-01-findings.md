# S0-01 findings: Agent SDK tool pool access

**Task:** [S0-01-agent-sdk.md](./S0-01-agent-sdk.md)  
**Date:** 2026-08-28  
**Method:** Documentation and API-surface review (no live probe run)  
**SDK package:** `@anthropic-ai/claude-agent-sdk` v0.3.250 (npm, not installed in repo)

## Question

Does the Claude Agent SDK expose **structural, runtime access** to an agent's **resolved tool pool** — i.e. the set of tools available to the model after config, permissions, and MCP wiring — suitable for Capsight's `observed` layer (SPEC §9.1)?

## Summary verdict

| Aspect | Verdict | Confidence |
|--------|---------|------------|
| Unified "list all resolved tools" API | **Not available** | high |
| MCP tool inventory per server | **Available** via `mcpServerStatus()` | medium-high |
| Built-in / deferred tool names | **Partial** via `getContextUsage()` | medium |
| Permission-filtered effective pool | **Not exposed** structurally | high |
| Suitable alone for `ObservedCapability` matrix | **Inconclusive** — needs live fixture probe + S0-02/03 | medium |

**Overall:** **Partially available / inconclusive for v0.1 observed layer.** MCP introspection is promising; built-in coverage is indirect; no API returns the permission-resolved effective pool Capsight needs to compare `resolved != observed`.

---

## Attempts

### 1. npm + official TypeScript SDK reference

| Field | Value |
|-------|-------|
| **Attempted** | `npm view @anthropic-ai/claude-agent-sdk`; [Agent SDK TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript) |
| **Result** | Package exists (v0.3.250). `Query` interface documents introspection methods; no `supportedTools()` or equivalent. |
| **Confidence** | high |

### 2. `Query.mcpServerStatus()`

| Field | Value |
|-------|-------|
| **Attempted** | Read `McpServerStatus` type and method docs |
| **Result** | Returns per-server status plus `tools?: { name, description?, annotations? }[]`. Changelog notes `tools` field added for richer introspection; includes SDK-added and dynamic MCP servers (v0.3.x). Covers **MCP-origin tools only**, not built-ins. |
| **Evidence** | TS reference: `mcpServerStatus(): Promise<McpServerStatus[]>`; type includes `tools` array |
| **Confidence** | medium-high (documented contract; not live-verified) |

### 3. `Query.getContextUsage()`

| Field | Value |
|-------|-------|
| **Attempted** | Read `SDKControlGetContextUsageResponse` |
| **Result** | Returns context-window breakdown including `mcpTools[]`, optional `deferredBuiltinTools[]`, optional `systemTools[]` (name + token counts). Docs explicitly warn: *"Claude Code leaves the optional `deferredBuiltinTools`, `systemTools`, and `systemPromptSections` diagnostics unset, so expect them to be absent."* Purpose is `/context` display, not capability auditing. |
| **Evidence** | TS reference § `SDKControlGetContextUsageResponse` |
| **Confidence** | medium |

### 4. `Query.initializationResult()` / `supportedAgents()` / `supportedCommands()`

| Field | Value |
|-------|-------|
| **Attempted** | Read `SDKControlInitializeResponse`, `AgentInfo` |
| **Result** | Init payload: `commands`, `agents`, `models`, `account` — **no tools**. `supportedAgents()` lists subagent type definitions (name, description, model), not tool pool. `supportedCommands()` is slash commands, not tools. |
| **Confidence** | high |

### 5. Configuration options (`tools`, `disallowedTools`, `allowedTools`)

| Field | Value |
|-------|-------|
| **Attempted** | Read `Options` table |
| **Result** | **Input-side** configuration only. `tools` restricts built-ins; `disallowedTools` removes from context; `allowedTools` auto-approves permissions but does not restrict availability. No read-back of effective resolved set after settings merge. |
| **Confidence** | high |

### 6. Hooks and callbacks (`canUseTool`, `PreToolUse`)

| Field | Value |
|-------|-------|
| **Attempted** | Permissions + hooks sections |
| **Result** | **Event-driven**, not structural. `canUseTool` fires on permission prompts; `PreToolUse` fires on invocation. Useful for S0-03 (observed invocations), not for listing the pool. Aligns with SPEC §9.3 one-sided observation limit. |
| **Confidence** | high |

### 7. Live fixture probe

| Field | Value |
|-------|-------|
| **Attempted** | `agent-sdk-spike.ts` against `tests/fixtures/claude/*` |
| **Result** | **Not run** — per spike policy (§9.4: explicit dev mode, no auto-probe). Script stub created for manual execution. |
| **Confidence** | n/a |

---

## Implications for Capsight

### What Agent SDK could support (if live probe confirms docs)

```typescript
// Hypothetical observed evidence — NOT production code
{
  capabilityId: "mcp__server__toolname",
  observedStatus: "available",       // only if tool appears in mcpServerStatus
  evidenceKind: "absence",             // listing ≠ invocation proof (§9.3)
  source: "agent-sdk",
  confidence: "medium",
}
```

- **MCP tools:** `mcpServerStatus()` may populate `observed` for MCP capabilities with `confidence: medium` until fixture-validated.
- **Built-in tools:** `getContextUsage()` names may supplement but are incomplete and context-oriented → `confidence: low–medium`.
- **Permission-denied tools:** No structural API; would need active harness (explicitly out of scope for v0.1 per §9.3).

### Gaps vs SPEC §9.2 #1 expectation

SPEC positions Agent SDK as the *most likely* source of structural tool-pool access. Findings:

1. SDK exposes **fragments** (MCP status, context usage), not a **resolved pool snapshot**.
2. Cannot distinguish `available` vs `not-observed` vs `denied` without invocation hooks (S0-03).
3. Requires spawning Claude Code subprocess + credentials — heavy for scan path; fits developer/fixture probe only (§9.4).

---

## Artifacts

| File | Purpose |
|------|---------|
| `src/adapters/claude/probing/agent-sdk-spike.ts` | Manual probe stub (not scan-wired) |
| `src/adapters/claude/probing/README.md` | Probing safety + run instructions |
| `src/adapters/claude/probing/agent-sdk-types.shim.d.ts` | Typecheck without SDK install |

---

## Blockers / next steps

1. **Live fixture probe** — install SDK locally, run spike against a fixture with known MCP config; record actual `mcpServerStatus` / `getContextUsage` payloads.
2. **S0-02** — check whether `SubagentStart` hook JSON includes tool context for subagents.
3. **S0-03** — `PreToolUse` for invocation-side `observedStatus: "available"`.
4. **S0-05 decision** — if live probe confirms gaps, §9.5 fallback (drop `observed` from v0.1) remains likely.

---

## Acceptance checklist (S0-01)

- [x] Document attempt: SDK API surface searched, what was tried
- [x] Record: available / not available / inconclusive with evidence
- [x] Spike script exists but is NOT invoked by normal scan
- [x] Findings file created at `docs/tasks/S0-01-findings.md`
