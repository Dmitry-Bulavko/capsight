# SubagentStart hook probe (S0-02)

Dev/test-only notes for SPEC §9.2 #2. **Not wired to scan.**

**Question:** Does `SubagentStart` stdin JSON expose an agent's resolved tool composition?

**Doc-based answer (2026-08-28):** **No.** Payload carries subagent identity (`agent_type`, `agent_id`) and session context only. See [S0-02 findings](../../../../docs/tasks/S0-02-findings.md).

**Official reference:** [Hooks — SubagentStart](https://code.claude.com/docs/en/hooks#subagentstart)

---

## Example hook configuration (fixture / dev only)

Place under a **fixture project**, e.g. `tests/fixtures/claude/basic/project/.claude/settings.local.json`. Use `settings.local.json` so the probe stays out of committed project settings.

```json
{
  "hooks": {
    "SubagentStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node",
            "args": [
              "${CLAUDE_PROJECT_DIR}/.claude/hooks/log-subagent-start.mjs"
            ],
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

### Matcher variants

| Matcher | Fires when |
|---------|------------|
| `"*"` or omitted | Every subagent spawn |
| `"Explore"` | Built-in Explore agent only |
| `"Plan"` | Built-in Plan agent |
| `"general-purpose"` | Default subagent type |
| `"backend"` | Custom agent whose frontmatter `name` is `backend` |
| `"^my-plugin:reviewer$"` | Plugin-scoped agent (regex; anchor for exact match) |

Built-in types: `general-purpose`, `Explore`, `Plan`. Custom agents use frontmatter **`name`**, not filename.

---

## Example logger script (dev only)

`.claude/hooks/log-subagent-start.mjs` — append stdin JSON to a local log; never commit secrets.

```javascript
#!/usr/bin/env node
import { appendFileSync } from "node:fs";
import { stdin } from "node:process";

const chunks = [];
for await (const chunk of stdin) chunks.push(chunk);
const raw = Buffer.concat(chunks).toString("utf8");
const payload = JSON.parse(raw);

const line = JSON.stringify({
  capturedAt: new Date().toISOString(),
  event: payload.hook_event_name,
  agent_type: payload.agent_type,
  agent_id: payload.agent_id,
  keys: Object.keys(payload).sort(),
  raw: payload,
});

appendFileSync(".claude/subagent-start-probe.log", line + "\n", "utf8");
process.exit(0);
```

`SubagentStart` is **non-blocking** — exit `0` always; stderr is shown to the user only.

---

## Documented stdin payload (official example)

Claude Code sends JSON on **stdin** (command hooks) or POST body (HTTP hooks):

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/example/.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/example/my-project",
  "hook_event_name": "SubagentStart",
  "agent_id": "agent-abc123",
  "agent_type": "Explore"
}
```

### Extended payload (common fields — may appear)

Per [Common input fields](https://code.claude.com/docs/en/hooks#common-input-fields), these **may** also be present; the SubagentStart section does not show them in its canonical example:

```json
{
  "session_id": "abc123",
  "prompt_id": "550e8400-e29b-41d4-a716-446655440000",
  "transcript_path": "/Users/example/.claude/projects/.../transcript.jsonl",
  "cwd": "/Users/example/my-project",
  "permission_mode": "default",
  "hook_event_name": "SubagentStart",
  "agent_id": "agent-abc123",
  "agent_type": "backend"
}
```

Live probe should record `Object.keys(payload)` to confirm which optional common fields appear.

---

## Field analysis

| Field | Required | Source | Meaning | Tool-composition? |
|-------|----------|--------|---------|-------------------|
| `hook_event_name` | yes | common | Always `"SubagentStart"` | No |
| `session_id` | yes | common | Parent session ID | No |
| `transcript_path` | yes | common | Main session transcript path (may lag) | No |
| `cwd` | yes | common | CWD when hook runs | No |
| `agent_id` | yes | **event-specific** | Unique subagent run ID | No — correlation only |
| `agent_type` | yes | **event-specific** | Agent name (matcher value) | No — identity, not tools |
| `prompt_id` | optional | common | Current prompt UUID (v2.1.196+) | No |
| `permission_mode` | optional | common | Session mode: `default`, `plan`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions` | No — not agent tool allowlist |
| `effort` | optional | common | `{ "level": "low"|"medium"|"high"|"xhigh"|"max" }` | No |

### Fields **not** in documented SubagentStart input

| Expected if tool composition were exposed | Status |
|-------------------------------------------|--------|
| `tools` / `allowedTools` / `disallowedTools` | **Absent** from official schema |
| MCP server list or `mcp__*` tool names | **Absent** |
| Resolved effective tool pool | **Absent** |
| Agent frontmatter snapshot | **Absent** — use declared scan layer |
| Spawn prompt / `tool_input` from Agent call | **Absent** — see `PreToolUse` on `Agent` tool instead |

---

## Hook output (for completeness)

SubagentStart cannot block spawn. Optional JSON stdout:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "SubagentStart",
    "additionalContext": "Optional string injected into subagent context before first prompt"
  }
}
```

Output affects subagent **context**, not tool registration.

---

## Manual run procedure

1. Copy hook config + logger into a **fixture** project only (SPEC §9.4).
2. Start Claude Code in that project directory with credentials on the developer machine.
3. Ask the main agent to spawn a subagent, e.g. *"Use the Explore agent to list top-level directories."*
4. Inspect `.claude/subagent-start-probe.log` for captured keys and values.
5. Compare `agent_type` to fixture `.claude/agents/*.md` frontmatter `name` — not to `tools`.

Requires Claude Code CLI; not invoked by Capsight scan.

---

## Related observation paths

| Mechanism | What it observes | S0 task |
|-----------|------------------|---------|
| `SubagentStart` | Subagent **type** at spawn | S0-02 (this doc) |
| `PreToolUse` (inside subagent) | **Tool invocations** with `agent_id` / `agent_type` | S0-03 |
| `PreToolUse` (Agent tool) | Spawn request with `tool_input.subagent_type` | S0-03 |
| Agent SDK `mcpServerStatus()` | MCP tool inventory | S0-01 |
| Agent frontmatter | Declared `tools` / `disallowedTools` | M0+ resolved layer |

---

## Safety (SPEC §9.4)

| Rule | This probe |
|------|------------|
| Fixture projects only | Yes — use `tests/fixtures/claude/*/project` |
| Developer/test mode | Manual Claude Code session only |
| No scan integration | This markdown is documentation; not imported by adapter |
| No third-party MCP | Hook logger is local Node; no MCP |
| Observations ≠ configuration | Log file is evidence, not config truth |
