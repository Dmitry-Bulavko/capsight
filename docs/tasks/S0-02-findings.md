# S0-02 findings: SubagentStart hook payload

**Task:** [S0-02-hooks.md](./S0-02-hooks.md)  
**Date:** 2026-08-28  
**Method:** Official documentation review (no live probe run)  
**Primary source:** [Claude Code Hooks reference — SubagentStart](https://code.claude.com/docs/en/hooks#subagentstart)

## Question

Does the `SubagentStart` hook JSON payload expose **agent tool composition** — the resolved set of tools available to a subagent at spawn time — suitable for Capsight's `observed` layer (SPEC §9.1–§9.3)?

SPEC §9.2 #2 notes the hook receives `agent_type` and asks to inspect the rest of the input JSON.

## Summary verdict

| Aspect | Verdict | Confidence |
|--------|---------|------------|
| `agent_type` present | **Yes** — event-specific field; matcher target | high |
| `agent_id` present | **Yes** — unique subagent run identifier | high |
| Resolved tool list / pool | **Not in payload** | high |
| `tools` / `disallowedTools` / MCP tool inventory | **Not in payload** | high |
| Permission mode at spawn | **Not in official example**; common-field docs say check per-event | medium |
| Useful alone for `ObservedCapability` matrix | **No** — identity only, not tool composition | high |

**Overall:** **Not useful for observed tool-composition layer.** `SubagentStart` identifies *which* subagent spawned (`agent_type`, `agent_id`) and session context, but official schema documents **no tool-related input fields**. Tool observation remains with `PreToolUse` (S0-03) or Agent SDK (S0-01).

---

## Attempts

### 1. Official Hooks reference — event catalog

| Field | Value |
|-------|-------|
| **Attempted** | Read [Hooks reference](https://code.claude.com/docs/en/hooks) event table and `SubagentStart` section |
| **Result** | Fires when a subagent is spawned via the **Agent** tool. Matcher filters on `agent_type`. Built-in values: `general-purpose`, `Explore`, `Plan`; custom agents use frontmatter `name`; plugin agents use scoped names like `my-plugin:reviewer`. |
| **Confidence** | high |

### 2. SubagentStart input schema

| Field | Value |
|-------|-------|
| **Attempted** | Read documented stdin JSON example and event-specific field table |
| **Result** | Documented payload = common fields + `agent_id` + `agent_type`. Official example: |

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-....jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "SubagentStart",
  "agent_id": "agent-abc123",
  "agent_type": "Explore"
}
```

| **Confidence** | high |

### 3. Common input fields — tool-related scan

| Field | Value |
|-------|-------|
| **Attempted** | Read [Common input fields](https://code.claude.com/docs/en/hooks#common-input-fields) for fields that might imply tool access |
| **Result** | Common fields: `session_id`, `prompt_id`, `transcript_path`, `cwd`, `permission_mode`, `effort`, `hook_event_name`. When inside a subagent (or `--agent` session), `agent_id` and `agent_type` are added. **None describe tools, MCP servers, or permission rules.** `permission_mode` reflects session mode, not per-agent tool allowlists. |
| **Confidence** | high |

### 4. SubagentStart output / side effects

| Field | Value |
|-------|-------|
| **Attempted** | Read decision control for `SubagentStart` |
| **Result** | **Context-only** — cannot block subagent creation. May return `hookSpecificOutput.additionalContext` injected into subagent context. `SessionStart` output also supports `reloadSkills`; `SubagentStart` does **not** list `reloadSkills` in its output table. |
| **Confidence** | high |

### 5. Agent SDK hooks parity

| Field | Value |
|-------|-------|
| **Attempted** | Read [Agent SDK hooks](https://code.claude.com/docs/en/agent-sdk/hooks) |
| **Result** | `SubagentStart` supported in SDK. TypeScript: `agent_id` / `agent_type` on base hook input. Python: required on `SubagentStart` / `SubagentStop`. No additional tool-pool types documented. |
| **Confidence** | high |

### 6. Related events (not SubagentStart, but tool-adjacent)

| Field | Value |
|-------|-------|
| **Attempted** | Cross-check `PreToolUse` on Agent tool and subagent-scoped tool events |
| **Result** | When parent calls **Agent** tool, `PreToolUse` receives `tool_input.subagent_type` (spawn intent), not resolved tools. After spawn, `PreToolUse` / `PostToolUse` inside the subagent carry `agent_id` + `agent_type` plus `tool_name` / `tool_input` **only when a tool is invoked** — invocation-side observation (S0-03), not composition at start. |
| **Confidence** | high |

### 7. Live fixture probe

| Field | Value |
|-------|-------|
| **Attempted** | Run hook logger against `tests/fixtures/claude/*` |
| **Result** | **Not run** — per SPEC §9.4 (explicit dev mode, no auto-probe). Example config documented in probing artifact for manual use. |
| **Confidence** | n/a |

---

## Field inventory (documented SubagentStart input)

| Field | Category | Tool-composition relevance |
|-------|----------|----------------------------|
| `hook_event_name` | common | `"SubagentStart"` — event discriminator |
| `session_id` | common | Session correlation only |
| `transcript_path` | common | Transcript path; async, may lag |
| `cwd` | common | Working directory at hook time |
| `prompt_id` | common | May be absent until first user input (v2.1.196+) |
| `permission_mode` | common | Session permission mode; **not** per-agent tool list |
| `effort` | common | Model effort level when present; not tool-related |
| `agent_id` | **SubagentStart-specific** | Subagent run ID; correlate with `PreToolUse` inside subagent |
| `agent_type` | **SubagentStart-specific** | Agent name for matcher; maps to declared agent `name`, not tools |
| `tools`, `disallowedTools`, `mcpServers`, `tool_names`, `allowedTools` | — | **Not documented** in SubagentStart input |

---

## Implications for Capsight

### What SubagentStart could support (limited)

```typescript
// Hypothetical — identity correlation only, NOT tool pool evidence
{
  capabilityId: "agent:Explore",  // or custom agent name
  observedStatus: "available",    // subagent spawn observed — NOT a tool
  evidenceKind: "absence",        // spawn ≠ tool invocation (§9.3)
  source: "hook",
  confidence: "high",
}
```

- **Agent identity at runtime:** Confirms a subagent of type `agent_type` actually spawned — useful to validate **declared agent exists and is reachable**, not tool matrix.
- **Tool composition:** Must come from **declared/resolved** layers (frontmatter `tools`, `disallowedTools`) or **invocation** hooks (S0-03). SubagentStart adds no structural tool data.

### Gaps vs SPEC §9.2 #2 expectation

SPEC positions SubagentStart as the second probe after Agent SDK. Findings:

1. Payload confirms **`agent_type` only** among subagent-specific fields — matches SPEC's known field.
2. **No remainder of input JSON** carries tool composition; documentation is explicit and minimal.
3. Cannot populate `ObservedCapability` for individual tools from this hook alone.
4. Cannot distinguish `available` vs `not-observed` for tools without `PreToolUse` (§9.3).

### Possible indirect use (out of S0-02 scope)

- Join `agent_type` from hook with scan-time **resolved** tool pool for that agent → compares runtime spawn to static config, not runtime tool pool.
- Log `agent_id` to stitch subagent-scoped `PreToolUse` events (S0-03).

---

## Artifacts

| File | Purpose |
|------|---------|
| `src/adapters/claude/probing/hooks-subagent-start.md` | Example hook config, payload, field notes (dev/test only) |

---

## Blockers / next steps

1. **Live fixture probe** — optional confirmation that real stdin matches docs (no extra tool fields in practice).
2. **S0-03** — `PreToolUse` for invocation-side `observedStatus: "available"`.
3. **S0-05 decision** — with S0-01 partial + S0-02 negative, observed layer likely remains inconclusive unless S0-03 yields sufficient invocation evidence.

---

## Acceptance checklist (S0-02)

- [x] Payload fields documented (`agent_type` and tool-related fields assessed)
- [x] Assessment: useful for observed layer — **no** (with high confidence on docs)
- [x] Example hook config documented (dev/test only)
- [x] Findings file created at `docs/tasks/S0-02-findings.md`
- [x] Probing notes at `src/adapters/claude/probing/hooks-subagent-start.md`
