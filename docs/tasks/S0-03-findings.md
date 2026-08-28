# S0-03 findings: PreToolUse hook logging

**Task:** [S0-03-hooks.md](./S0-03-hooks.md)  
**Date:** 2026-08-28  
**Method:** Official documentation review (no live probe run)  
**Primary source:** [Claude Code Hooks reference — PreToolUse](https://code.claude.com/docs/en/hooks#pretooluse)

## Question

Can the `PreToolUse` hook log **actual tool invocations** for Capsight's `observed` layer (SPEC §9.1–§9.3), and what are the **one-sided observation limits**?

SPEC §9.2 #3 positions PreToolUse as the third probe: log tools the agent actually calls. SPEC §9.3 states observation is one-sided — absence of a call is not evidence of denial.

## Summary verdict

| Aspect | Verdict | Confidence |
|--------|---------|------------|
| `tool_name` on every invocation | **Yes** — event-specific, matcher target | high |
| `tool_input` with tool-specific args | **Yes** | high |
| `tool_use_id` for correlation | **Yes** | high |
| Subagent context (`agent_id`, `agent_type`) | **Yes** when hook fires inside subagent | high |
| Resolved tool pool / allowlist in payload | **No** | high |
| Positive `observedStatus: "available"` evidence | **Yes** — per invoked tool | high |
| Infer `denied` from hook silence | **Invalid** — §9.3 forbids | high |
| Full capability matrix from passive logging alone | **Incomplete** — one-sided by design | high |

**Overall:** **Useful for invocation-side observation.** PreToolUse is the primary hook path for `evidenceKind: "tool-invoked"` and `observedStatus: "available"`. It cannot prove tools are forbidden or enumerate the full resolved pool; uncalled tools remain `not-observed`.

---

## Attempts

### 1. Official Hooks reference — PreToolUse role

| Field | Value |
|-------|-------|
| **Attempted** | Read event table and PreToolUse section |
| **Result** | Fires **before** each tool call in the agentic loop (except `EndConversation`). Matcher runs against `tool_name`. Can block/modify via `hookSpecificOutput`; passive logging uses exit `0` with no decision. |
| **Confidence** | high |

### 2. PreToolUse input schema

| Field | Value |
|-------|-------|
| **Attempted** | Read common + event-specific fields and Bash example |
| **Result** | Documented payload = common fields + `tool_name` + `tool_input` + `tool_use_id`. Canonical Bash example: |

```json
{
  "session_id": "abc123",
  "prompt_id": "550e8400-e29b-41d4-a716-446655440000",
  "transcript_path": "/home/user/.claude/projects/.../transcript.jsonl",
  "cwd": "/home/user/my-project",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test",
    "description": "Run test suite",
    "timeout": 120000,
    "run_in_background": false
  },
  "tool_use_id": "toolu_01ABC123..."
}
```

| **Confidence** | high |

### 3. Subagent and Agent-tool payloads

| Field | Value |
|-------|-------|
| **Attempted** | Read subagent hook behavior and Agent `tool_input` table |
| **Result** | Hooks from settings/plugins run inside subagents; subagent tool events include `agent_id` + `agent_type`. Parent **Agent** tool PreToolUse carries `tool_input.subagent_type` (spawn intent), not resolved subagent tools. Correlate subagent invocations via `agent_id` from Agent PostToolUse / SubagentStart. |
| **Confidence** | high |

### 4. MCP and matcher patterns

| Field | Value |
|-------|-------|
| **Attempted** | Read matcher docs and MCP tool naming |
| **Result** | MCP tools use normal `tool_name` values like `mcp__server__tool`. Matcher supports regex e.g. `mcp__.*`. Same events as built-ins. |
| **Confidence** | high |

### 5. Observation gaps (one-sided limits)

| Field | Value |
|-------|-------|
| **Attempted** | Cross-check PreToolUse limitations vs SPEC §9.3 |
| **Result** | **Does not fire** for `EndConversation`. **Does not fire** when files are added via `@` references (no Read tool call). **Does not list** unused tools. `permission_mode` is session context, not per-tool state. `observedStatus: "denied"` would need `PermissionDenied` or active retry harness — SPEC marks v0.1 out of scope. |
| **Confidence** | high |

### 6. Agent SDK hooks parity

| Field | Value |
|-------|-------|
| **Attempted** | Cross-reference S0-01 findings on PreToolUse in SDK |
| **Result** | SDK exposes PreToolUse as event-driven callback — same invocation-side semantics, not structural pool listing. Aligns with §9.3. |
| **Confidence** | high |

### 7. Live fixture probe

| Field | Value |
|-------|-------|
| **Attempted** | Run hook logger against `tests/fixtures/claude/*` |
| **Result** | **Not run** — per SPEC §9.4 (explicit dev mode, no auto-probe). Example config documented in probing artifact for manual use. |
| **Confidence** | n/a |

---

## Field inventory (documented PreToolUse input)

| Field | Category | Observation relevance |
|-------|----------|----------------------|
| `hook_event_name` | common | `"PreToolUse"` |
| `session_id` | common | Session correlation |
| `transcript_path` | common | May lag; secondary evidence |
| `cwd` | common | Context for file tools |
| `prompt_id` | common | Optional; telemetry correlation |
| `permission_mode` | common | Session mode — **not** per-tool allowlist |
| `effort` | common | Model effort; not tool-related |
| `agent_id` | subagent context | Correlate subagent-scoped invocations |
| `agent_type` | subagent context | Map to declared agent name |
| **`tool_name`** | **PreToolUse-specific** | **Primary observed capability ID** |
| **`tool_input`** | **PreToolUse-specific** | Invocation arguments (varies by tool) |
| **`tool_use_id`** | **PreToolUse-specific** | Dedupe; join PostToolUse |
| Resolved tool pool, `tools`, `disallowedTools` | — | **Not in payload** |

---

## SPEC §9.3 — one-sided observation (mandatory semantics)

From SPEC §9.3:

| Rule | Capsight handling |
|------|-------------------|
| PreToolUse records **only invoked** tools | Aggregate distinct `tool_name` → `available` |
| Absence of call ≠ prohibition | Uncalled tools → `not-observed`, never `denied` |
| `denied` requires attempted call + refusal | Active harness; **not v0.1** |
| `resolved != observed` for an **invoked** tool missing from resolved | Critical adapter defect |

```typescript
interface ObservedCapability {
  capabilityId: string;
  context: ExecutionContext;
  observedStatus: "available" | "denied" | "not-observed";
  /** One-sided: absence does NOT mean denied */
  evidenceKind: "tool-invoked" | "permission-denied" | "absence";
  source: "agent-sdk" | "hook" | "debug-log";
  confidence: "high" | "medium" | "low";
  claudeVersion: string;
  timestamp: string;
}
```

**PreToolUse maps cleanly to:** `observedStatus: "available"` + `evidenceKind: "tool-invoked"` + `source: "hook"`.

**PreToolUse must not map:** hook silence → `denied`; unresolved pool membership → `available`.

---

## Implications for Capsight

### What PreToolUse supports

1. **Runtime proof a tool was invoked** — strongest passive observation path in S0 spike order (after partial Agent SDK).
2. **Subagent-scoped tool usage** — via `agent_id` / `agent_type` on events inside subagents.
3. **Spawn intent** — Agent tool `tool_input.subagent_type` before subagent runs (complements S0-02 SubagentStart).
4. **MCP tool invocations** — `mcp__*` names in logs; structural MCP inventory still from S0-01 `mcpServerStatus()`.

### What PreToolUse cannot support alone

1. Full effective tool pool at session start.
2. Proof that a tool is **forbidden** (only that it was not called).
3. Coverage of `@`-referenced files without Read tool calls.
4. EndConversation or other non-tool lifecycle events.

### Recommended observed-layer strategy (S0 spike context)

| Layer | Source |
|-------|--------|
| Declared / resolved | Scan (M0+) |
| MCP inventory (structural) | Agent SDK S0-01 |
| Invoked tools (positive) | PreToolUse S0-03 |
| Spawn identity | SubagentStart S0-02 + Agent PreToolUse |
| Gap: resolved but never called | `not-observed` — document, do not infer deny |

---

## Artifacts

| File | Purpose |
|------|---------|
| `src/adapters/claude/probing/hooks-pretooluse.md` | Example hook config, payload fields, one-sided limits, dev logger (dev/test only) |

---

## Blockers / next steps

1. **Live fixture probe** — optional confirmation that logged `tool_name` set matches expectations for fixture agents.
2. **S0-04** — `claude -p --debug` last-resort only (`confidence: low`).
3. **S0-05 decision** — combine S0-01 partial + S0-02 negative composition + S0-03 positive-but-one-sided to decide v0.1 observed-layer scope.

---

## Acceptance checklist (S0-03)

- [x] Payload fields documented (`tool_name`, `tool_input`, `tool_use_id`, common/subagent fields)
- [x] One-sided limitation documented (`not-observed` ≠ `denied`; §9.3 semantics)
- [x] Dev-only example hook (config + passive logger script)
- [x] Findings file created at `docs/tasks/S0-03-findings.md`
- [x] Probing notes at `src/adapters/claude/probing/hooks-pretooluse.md`
