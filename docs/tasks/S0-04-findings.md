# S0-04 findings: `claude -p --debug` log parsing

**Task:** [S0-04-debug.md](./S0-04-debug.md)  
**Date:** 2026-08-28  
**Method:** CLI help review + cross-reference with S0-01/02/03 (no live probe run)  
**Primary source:** `claude --help` (local Claude Code CLI)

## Question

Can parsing **`claude -p --debug`** output serve as a last-resort observation source for Capsight's `observed` layer (SPEC §9.1–§9.3), and should Capsight implement it in v0.1?

SPEC §9.2 #4 positions debug-log parsing as the **fourth and final** probe attempt: not a contract, likely to break on the next release, **`confidence: low` only**.

## Summary verdict

| Aspect | Verdict | Confidence |
|--------|---------|------------|
| Debug mode exists on CLI | **Yes** — `-d` / `--debug [filter]`, `--debug-file <path>` | high |
| Structured, documented log schema | **No** — stderr/file text; categories filterable but not specified | high |
| Stable across Claude Code releases | **No** — explicitly non-contract per SPEC §9.2 #4 | high |
| Tool-pool / capability inventory | **Unreliable** — incidental log lines, not an API | high |
| Tool invocation evidence | **Redundant** — PreToolUse (S0-03) is contract-backed | high |
| MCP / SDK structural data | **Redundant** — Agent SDK `mcpServerStatus()` (S0-01) | high |
| Suitable for Capsight scan path | **No** — dev-only, fragile, credentials required | high |
| Implement in v0.1 | **Defer** — use only if S0-01 + S0-03 prove insufficient | high |

**Overall:** **Document and defer.** Debug log parsing is a valid *manual spike* escape hatch for developers stuck without hook/SDK signal, but it must **not** be wired to scan and must always carry `source: "debug-log"` + `confidence: "low"`. Given S0-01 partial SDK coverage and S0-03 high-confidence invocation logging, **no parser implementation is warranted now**.

---

## Attempts

### 1. CLI flags — debug surface

| Field | Value |
|-------|-------|
| **Attempted** | `claude --help` on developer machine |
| **Result** | Relevant flags: |

```
-d, --debug [filter]     Enable debug mode with optional category filtering
                         (e.g., "api,hooks" or "!1p,!file")
--debug-file <path>      Write debug logs to a specific file path
                         (implicitly enables debug mode)
-p, --print              Non-interactive: print response and exit
--output-format <format> text | json | stream-json (with -p)
--include-hook-events    Hook lifecycle in stream-json (with -p)
```

| **Confidence** | high |

**Interpretation:** Debug output is a **diagnostic channel**, not a published observation API. Category filters (`api`, `hooks`, `!1p`, `!file`) imply internal log taxonomy that can change without notice.

### 2. Intended invocation pattern (SPEC §9.2 #4)

| Field | Value |
|-------|-------|
| **Attempted** | Derive canonical dev-only probe command from help + §9.4 safety |
| **Result** | Hypothetical fixture probe ( **not run** ): |

```bash
# Fixture project only — SPEC §9.4
cd tests/fixtures/claude/<fixture>/project
claude -p --debug hooks,api --debug-file .claude/debug-probe.log \
  "List one file in this directory using Read."
```

Combine `-p` (non-interactive) with `--debug` / `--debug-file` to capture stderr-adjacent diagnostics alongside the normal print response. Exact line formats are **implementation-defined**.

| **Confidence** | medium (pattern plausible; format unverified) |

### 3. Comparison with higher-priority probes (§9.2 #1–3)

| Field | Value |
|-------|-------|
| **Attempted** | Cross-reference S0-01, S0-02, S0-03 findings |
| **Result** | |

| Need | Better source (S0) | Debug log value |
|------|-------------------|-----------------|
| MCP tool inventory (structural) | Agent SDK `mcpServerStatus()` (S0-01) | Incidental; unparsed |
| Tool invocations (positive) | PreToolUse hook (S0-03) | Duplicate, lower trust |
| Subagent identity at spawn | SubagentStart (S0-02) | May appear in `hooks` category — unstructured |
| Resolved effective tool pool | **None** (gap across S0) | **Might** leak in debug text — **not reliable** |

| **Confidence** | high |

Debug logs do **not** close the resolved-pool gap that motivated §9. They at best offer **heuristic hints** extractable only via brittle regex over changing strings.

### 4. Risks and non-contract nature

| Field | Value |
|-------|-------|
| **Attempted** | Assess production suitability vs SPEC §9.2 #4 |
| **Result** | |

| Risk | Impact |
|------|--------|
| **No stable schema** | Parser breaks every release; maintenance burden with no semver signal |
| **Mixed streams** | Debug may go to stderr, file, or both; `-p` stdout is user-facing response — easy to conflate |
| **Category renames** | Filter tokens (`api`, `hooks`, `1p`, `file`) are undocumented contracts |
| **Secrets in logs** | API/hook debug may echo headers, paths, or payloads — violates SPEC §0.1 #8 if ingested blindly |
| **Non-determinism** | Log volume and ordering vary by model, tools, and timing |
| **Hook bypass modes** | `--bare` skips hooks — debug + bare ≠ hook observation |
| **False positives** | Mention of a tool name in a log line ≠ invocation (§9.3 one-sided semantics still apply) |

| **Confidence** | high |

### 5. Alternative: `stream-json` + `--include-hook-events`

| Field | Value |
|-------|-------|
| **Attempted** | Evaluate structured `-p` output as debug substitute |
| **Result** | `claude -p --output-format stream-json --include-hook-events` exposes hook lifecycle in the **print output stream** — closer to a parse contract than raw `--debug`, but still tied to `-p` session semantics and not documented for Capsight's capability matrix. If structured hook events are needed, **configure PreToolUse** (S0-03) directly rather than scraping debug text. |
| **Confidence** | medium |

### 6. Live fixture probe

| Field | Value |
|-------|-------|
| **Attempted** | Run `claude -p --debug` against `tests/fixtures/claude/*` |
| **Result** | **Not run** — per SPEC §9.4 (explicit dev mode, no auto-probe). Would require API credentials and produce non-reproducible log samples tied to a single CLI version. |
| **Confidence** | n/a |

---

## Recommendation: defer unless hooks/SDK fail

### Decision

| Priority | Action |
|----------|--------|
| **Now (S0-04)** | Document approach + risks in probing notes; **do not implement parser** |
| **Before debug parser** | Exhaust S0-01 live fixture probe + S0-03 PreToolUse fixture logging |
| **If both insufficient** | Manual debug capture for **human triage only** — still `confidence: low`, not scan-wired |
| **v0.1 default** | Prefer §9.5 fallback (drop `observed` layer) over shipping debug-log parsing |

### Rationale

1. **S0-03 PreToolUse** already provides high-confidence `evidenceKind: "tool-invoked"` with a documented JSON stdin schema.
2. **S0-01 Agent SDK** covers MCP structural inventory with medium confidence — strictly better than regex on debug text.
3. **SPEC §9.2 #4** explicitly warns debug parsing is non-contract and last-resort; implementing it preemptively contradicts spike ordering.
4. **§9.4 safety** — debug probes need credentials, spawn Claude Code, and may leak sensitive data; unsuitable for ordinary scan.
5. **§9.3** — even if debug logs mention tools, absence in logs cannot imply `denied`; debug adds little beyond hooks for positive evidence.

### When debug logs might still help (manual only)

- Developer cannot enable hooks in a fixture (environment restriction) but can run `-p`.
- Investigating a **specific** Claude Code regression where hook/SDK payloads changed and debug categories expose new fields — spike triage, not product feature.
- Correlating internal `hooks` / `api` category failures during MCP wiring — operational debugging, not `ObservedCapability` emission.

---

## Hypothetical mapping (if ever used — not v0.1)

```typescript
// LAST RESORT ONLY — never scan-wired
{
  capabilityId: "tool:Read",        // extracted heuristically — fragile
  observedStatus: "available",      // only if log proves invocation, not mere mention
  evidenceKind: "tool-invoked",     // prefer PreToolUse instead
  source: "debug-log",
  confidence: "low",                // mandatory per §9.2 #4
  claudeVersion: "<from claude --version>",
  timestamp: "<capture time>",
}
```

**Never** promote debug-log `absence` to `denied`. **Never** use debug logs as configuration truth.

---

## Artifacts

| File | Purpose |
|------|---------|
| `src/adapters/claude/probing/debug-log-notes.md` | Dev-only notes: flags, risks, manual procedure, deferral guidance |

**NOT created:** parser script, scan integration, adapter imports.

---

## Blockers / next steps

1. **S0-05 decision** — combine S0-01/02/03 outcomes; debug path remains documented fallback only.
2. **Optional live sample** — if S0-05 blocks on missing signal, developer may capture one `--debug-file` from a fixture for human inspection (still no parser).
3. **§9.5 fallback** — if observed layer scope is cut from v0.1, S0-04 deferral stands; no revisit required.

---

## Acceptance checklist (S0-04)

- [x] Document approach and risks (non-contract, breaks on releases)
- [x] Recommendation: use only if S0-01/03 insufficient, confidence low; **defer implementation now**
- [x] NOT wired to scan
- [x] Findings file at `docs/tasks/S0-04-findings.md`
- [x] Probing notes at `src/adapters/claude/probing/debug-log-notes.md`
