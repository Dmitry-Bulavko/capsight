# PreToolUse hook probe (S0-03)

Dev/test-only notes for SPEC §9.2 #3 and §9.3. **Not wired to scan.**

**Question:** Can `PreToolUse` log actual tool invocations for Capsight's `observed` layer?

**Doc-based answer (2026-08-28):** **Yes, for invocation-side evidence only.** Each firing carries `tool_name`, `tool_input`, and `tool_use_id`. Observation is **one-sided** — tools never invoked remain `not-observed`, not `denied` (SPEC §9.3).

**Official reference:** [Hooks — PreToolUse](https://code.claude.com/docs/en/hooks#pretooluse)

---

## Example hook configuration (fixture / dev only)

Place under a **fixture project**, e.g. `tests/fixtures/claude/basic/project/.claude/settings.local.json`. Use `settings.local.json` so the probe stays out of committed project settings.

Log **all** tool calls (passive observation — no blocking):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node",
            "args": [
              "${CLAUDE_PROJECT_DIR}/.claude/hooks/log-pretooluse.mjs"
            ],
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

### Matcher variants (tool_name)

Matcher runs against the **`tool_name`** field from stdin JSON.

| Matcher | Fires when |
|---------|------------|
| `"*"` or omitted | Every tool call (except `EndConversation`; see gaps below) |
| `"Bash"` | Shell commands only |
| `"Bash\|PowerShell"` | Both shell tools (recommended on Windows) |
| `"Edit\|Write"` | File mutation tools |
| `"Read"` | Explicit Read tool calls |
| `"Agent"` | Subagent spawn requests (`tool_input.subagent_type`) |
| `"mcp__.*"` | MCP-origin tools (regex) |
| `"mcp__my-server__search"` | Single MCP tool (exact or regex) |

MCP tools appear as regular `tool_name` values like `mcp__server-name__tool-name`.

---

## Example logger script (dev only)

`.claude/hooks/log-pretooluse.mjs` — append stdin JSON to a local log; never commit secrets.

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
  tool_name: payload.tool_name,
  tool_use_id: payload.tool_use_id,
  agent_id: payload.agent_id ?? null,
  agent_type: payload.agent_type ?? null,
  keys: Object.keys(payload).sort(),
  raw: payload,
});

appendFileSync(".claude/pretooluse-probe.log", line + "\n", "utf8");
process.exit(0);
```

**Passive probe:** always exit `0` with no stdout decision. Do not block or modify tool calls during observation runs.

For selective logging (e.g. MCP only), add a second hook entry with `"matcher": "mcp__.*"` instead of filtering inside the script.

---

## Documented stdin payload

Claude Code sends JSON on **stdin** (command hooks) or POST body (HTTP hooks).

### Canonical example (Bash)

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

### Subagent-scoped example

When the hook fires **inside** a subagent (or `--agent` session), common fields include `agent_id` and `agent_type`:

```json
{
  "session_id": "abc123",
  "cwd": "/home/user/my-project",
  "hook_event_name": "PreToolUse",
  "agent_id": "a4d2c8f1e0b3a297",
  "agent_type": "Explore",
  "tool_name": "Glob",
  "tool_input": {
    "pattern": "**/*.ts"
  },
  "tool_use_id": "toolu_02DEF456..."
}
```

### Agent tool (spawn intent, not resolved tools)

When the **parent** calls the Agent tool to spawn a subagent:

```json
{
  "hook_event_name": "PreToolUse",
  "tool_name": "Agent",
  "tool_input": {
    "prompt": "Find all API endpoints",
    "description": "Find API endpoints",
    "subagent_type": "Explore",
    "model": "sonnet"
  },
  "tool_use_id": "toolu_03GHI789..."
}
```

`subagent_type` is spawn **intent**, not the subagent's resolved tool pool. Join with `SubagentStart` (`agent_type`) and subsequent subagent-scoped `PreToolUse` events via `agent_id`.

---

## Field analysis

### Common input fields

| Field | Required | Meaning | Observation use |
|-------|----------|---------|-----------------|
| `hook_event_name` | yes | Always `"PreToolUse"` | Event discriminator |
| `session_id` | yes | Session correlation | Stitch multi-turn logs |
| `transcript_path` | yes | Transcript file path (may lag) | Secondary evidence only |
| `cwd` | yes | Working directory at hook time | Context for file tools |
| `prompt_id` | optional | Current prompt UUID (v2.1.196+) | Correlate with telemetry |
| `permission_mode` | optional | Session mode (`default`, `plan`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`) | Context only — not per-tool allowlist |
| `effort` | optional | `{ "level": "low"\|"medium"\|"high"\|"xhigh"\|"max" }` | Not tool-related |
| `agent_id` | subagent only | Subagent run ID | Correlate invocations inside subagent |
| `agent_type` | subagent only | Agent name (`Explore`, custom frontmatter `name`, etc.) | Map to declared agent |

### PreToolUse-specific fields

| Field | Required | Meaning | Observation use |
|-------|----------|---------|-----------------|
| `tool_name` | yes | Invoked tool identifier; matcher target | **Primary capability key** — e.g. `Bash`, `Read`, `mcp__figma__get_file` |
| `tool_input` | yes | Tool arguments (schema varies by tool) | Evidence detail; not a tool inventory |
| `tool_use_id` | yes | Unique ID for this tool call | Dedupe / join with `PostToolUse` |

### Selected `tool_input` shapes (by tool_name)

| `tool_name` | Notable `tool_input` fields |
|-------------|----------------------------|
| `Bash` / `PowerShell` | `command`, `description`, `timeout`, `run_in_background` |
| `Read` / `Write` / `Edit` | `file_path` (always absolute; native separators on Windows) |
| `Glob` | `pattern`, optional `path` |
| `Grep` | `pattern`, optional `path`, `glob`, `output_mode`, flags |
| `Agent` | `prompt`, `description`, `subagent_type`, optional `model` |
| `WebFetch` / `WebSearch` | `url` or `query`, domain filters |
| `mcp__*__*` | Server-specific; name encodes server + tool |

Full per-tool tables: [PreToolUse input — tool_input fields](https://code.claude.com/docs/en/hooks#pretooluse-input).

---

## One-sided observation (SPEC §9.3)

**PreToolUse only records tools Claude actually calls.** This is the core limitation for Capsight's observed layer.

| Situation | Valid `observedStatus` | `evidenceKind` | Notes |
|-----------|------------------------|----------------|-------|
| Tool appears in `PreToolUse` log | `"available"` | `"tool-invoked"` | Positive evidence only |
| Tool in resolved pool but never called | `"not-observed"` | `"absence"` | **Not proof of denial** |
| Tool call blocked / denied at runtime | `"denied"` | `"permission-denied"` | Requires `PermissionDenied` or active harness; **v0.1 out of scope** |

**Never** promote `not-observed` → `denied`. Absence means the model did not invoke the tool during the observed session, not that the platform forbids it.

### What PreToolUse does **not** observe

| Gap | Implication |
|-----|-------------|
| Tools available but unused | Stay `not-observed` — compare against **resolved** layer, not hook silence |
| `EndConversation` | No `PreToolUse` / `PostToolUse` (by design) |
| `@` file references | Content injected without Read tool call — no PreToolUse for those paths |
| Resolved effective tool pool | Not in payload — use declared/resolved scan + Agent SDK (S0-01) |
| Permission allowlist / disallowedTools | Not in payload — `permission_mode` is session-wide context only |

---

## Mapping to `ObservedCapability` (hypothetical)

```typescript
// Positive invocation evidence only
{
  capabilityId: "tool:Bash",           // or mcp:server:tool from tool_name
  context: { agent_type: "Explore" }, // when agent_id present
  observedStatus: "available",
  evidenceKind: "tool-invoked",
  source: "hook",
  confidence: "high",
  claudeVersion: "<from probe session>",
  timestamp: "<capturedAt>",
}
```

Build the **set of observed tools** by aggregating distinct `tool_name` values over a probe session. Compare that set to the **resolved** pool; `resolved != observed` for a tool that was invoked but not in resolved is a critical adapter defect (SPEC §9.1).

---

## Hook output (avoid during passive probe)

PreToolUse supports decision control via stdout JSON (`permissionDecision`, `updatedInput`, etc.). **Observation probes must not emit decisions** — exit `0` with empty stdout so normal permission flow continues.

Blocking example (do **not** use in S0-03 observation runs):

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Blocked by policy hook"
  }
}
```

---

## Manual run procedure

1. Copy hook config + logger into a **fixture** project only (SPEC §9.4).
2. Start Claude Code in that project directory with credentials on the developer machine.
3. Run prompts that exercise known tools (Read a file, Bash `ls`, spawn Explore subagent).
4. Inspect `.claude/pretooluse-probe.log` for `tool_name`, `tool_input`, and optional `agent_id` / `agent_type`.
5. Compare logged `tool_name` values to fixture **resolved** tool pool — note tools in resolved but absent from log (`not-observed`).

Requires Claude Code CLI; not invoked by Capsight scan.

---

## Related observation paths

| Mechanism | What it observes | S0 task |
|-----------|------------------|---------|
| `PreToolUse` | **Tool invocations** (`tool_name`, `tool_input`) | S0-03 (this doc) |
| `PreToolUse` (Agent tool) | Spawn request with `tool_input.subagent_type` | S0-03 |
| `PreToolUse` (inside subagent) | Subagent tool calls + `agent_id` / `agent_type` | S0-03 |
| `PermissionDenied` | Denied tool attempts | Out of v0.1 scope (§9.3) |
| `SubagentStart` | Subagent **type** at spawn | S0-02 |
| Agent SDK `mcpServerStatus()` | MCP tool inventory (structural) | S0-01 |
| Agent frontmatter | Declared `tools` / `disallowedTools` | M0+ resolved layer |

---

## Safety (SPEC §9.4)

| Rule | This probe |
|------|------------|
| Fixture projects only | Yes — use `tests/fixtures/claude/*/project` |
| Developer/test mode | Manual Claude Code session only |
| No scan integration | This markdown is documentation; not imported by adapter |
| No third-party MCP | Hook logger is local Node; fixture MCP config only if fixture defines it |
| Observations ≠ configuration | Log file is evidence, not config truth |
| Passive observation | Exit 0; do not block or modify tool calls |
