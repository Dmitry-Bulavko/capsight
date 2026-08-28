# Debug log probe (S0-04)

Dev/test-only notes for SPEC §9.2 #4. **Not wired to scan. No parser implemented.**

**Question:** Can `claude -p --debug` output be parsed for Capsight's `observed` layer?

**Doc-based answer (2026-08-28):** **Only as a manual, low-confidence last resort.** Debug output is diagnostic text with no stable schema. **Defer** unless Agent SDK (S0-01) and PreToolUse hooks (S0-03) fail to provide enough signal for the S0-05 decision.

**Primary source:** `claude --help` (local CLI); SPEC §9.2 #4, §9.3, §9.4.

---

## Position in spike order (SPEC §9.2)

| Order | Probe | Capsight status |
|-------|-------|-----------------|
| 1 | Agent SDK | S0-01 — partial MCP introspection |
| 2 | `SubagentStart` hook | S0-02 — identity only, no tools |
| 3 | `PreToolUse` hook | S0-03 — invocation-side, high confidence |
| **4** | **`claude -p --debug`** | **S0-04 — defer; document only** |

Use debug logs **only after** #1–#3 are exhausted for a specific question — and even then treat results as **`confidence: low`**, never scan-automated.

---

## CLI surface

From `claude --help`:

| Flag | Meaning |
|------|---------|
| `-p`, `--print` | Non-interactive: print model response and exit |
| `-d`, `--debug [filter]` | Enable debug logging; optional category filter |
| `--debug-file <path>` | Write debug log to file (enables debug implicitly) |

**Category filter examples** (from help text):

```
--debug api,hooks       # include api and hooks categories
--debug !1p,!file       # exclude 1p and file categories
```

Categories are **internal** — not documented as a public API. Names and semantics may change without notice.

**Related (not debug, but structured `-p` output):**

| Flag | Notes |
|------|-------|
| `--output-format stream-json` | Structured print stream (with `-p`) |
| `--include-hook-events` | Hook lifecycle events in stream-json |

Prefer **PreToolUse hook JSON** (S0-03) over scraping debug text for hook-related observation.

---

## Example manual capture (fixture / dev only)

**Do not run on user projects.** Requires Claude Code CLI + API credentials.

```bash
cd tests/fixtures/claude/<fixture>/project

# Capture debug to a local file; keep response on stdout separate
claude -p \
  --debug hooks,api \
  --debug-file .claude/debug-probe.log \
  "Use Read on one file in this directory."
```

After the run:

1. Record `claude --version` alongside the log (parser would need version-specific rules).
2. Inspect `.claude/debug-probe.log` **manually** — look for tool names, MCP wiring, hook failures.
3. Do **not** commit logs if they may contain paths, tokens, or API details.
4. Compare any tool mentions to **PreToolUse** log from the same session — hooks win on conflicts.

### stderr vs file

Debug may appear on **stderr**, in **`--debug-file`**, or both depending on CLI version and config. There is no guarantee of a single stream suitable for machine parsing. Capsight must not assume a fixed layout.

---

## Why this is last resort

| Property | Debug logs | PreToolUse hook | Agent SDK |
|----------|------------|-----------------|-----------|
| Schema | None (text) | Documented JSON stdin | TS types / docs |
| Stability | Breaks on releases | Hooks reference | SDK semver (partial) |
| Tool invocations | Heuristic grep | `tool_name` per call | Event callbacks |
| MCP inventory | Incidental | Via `mcp__*` tool_name | `mcpServerStatus()` |
| Scan-safe | **No** (credentials, spawn) | **No** (dev fixture) | **No** (dev fixture) |
| `confidence` | **`low` only** | `high` (invocation) | `medium` (MCP list) |

SPEC §9.2 #4: *«Не является контрактом, сломается на следующем релизе. Только последним и только с `confidence: low`.»*

---

## Risks (do not underestimate)

### Non-contract / release fragility

- Log line format, prefixes, and category names are implementation details.
- Any regex-based parser requires per-version fixtures and will still drift.
- No semver or changelog commitment for debug text shape.

### Security (SPEC §0.1 #8)

Debug categories like `api` may echo request metadata, paths, or error bodies. **Never** ingest debug logs into Capsight cache or reports without redaction. Log and cache **capability IDs** only when manually extracted — never raw env values or tokens.

### Semantic traps (SPEC §9.3)

| Trap | Correct handling |
|------|------------------|
| Tool name appears in log but was not invoked | **Not** `observedStatus: "available"` |
| Tool absent from debug log | **Not** `denied` — use `not-observed` at most |
| Debug suggests permission error | Needs corroboration; v0.1 `denied` harness out of scope |

### Operational

- `-p` skips workspace trust dialog — fixture-only (§9.4).
- `--bare` disables hooks — debug under `--bare` does not replace PreToolUse.
- `--mcp-debug` is deprecated in favor of `--debug`.
- Large, noisy logs; filtering mistakes drop relevant lines.

---

## Recommendation: defer implementation

**For Capsight v0.1 and S0-05 decision:**

1. **Do not** add a debug-log parser under `src/adapters/claude/`.
2. **Do not** import this file or any debug probe from `adapter.ts` or CLI scan path.
3. **Rely on** S0-01 (SDK) + S0-03 (PreToolUse) for observation evidence.
4. **If insufficient**, prefer §9.5 fallback (drop `observed` from v0.1) over automating debug parsing.
5. **Optional:** one manual `--debug-file` capture during S0-05 triage for human inspection only.

Implement a parser **only if** a future spike proves hooks and SDK cannot answer a specific, scoped question **and** product accepts permanent `confidence: low` + maintenance cost.

---

## Hypothetical `ObservedCapability` mapping

If a human analyst extracts evidence from a debug log (not automated):

```typescript
{
  capabilityId: "tool:Bash",       // manual extraction — verify against PreToolUse
  context: {},
  observedStatus: "available",     // only with clear invocation proof in log
  evidenceKind: "tool-invoked",
  source: "debug-log",
  confidence: "low",               // mandatory — never medium or high
  claudeVersion: "x.y.z",
  timestamp: "ISO-8601",
}
```

Do not emit `ObservedCapability` from debug logs in production scan code.

---

## Manual triage checklist

When reviewing a captured debug log (developer spike):

- [ ] Record `claude --version`
- [ ] Confirm run was on a **fixture** project (§9.4)
- [ ] Cross-check tool names against PreToolUse log from same session
- [ ] Redact secrets before sharing or archiving
- [ ] Mark all conclusions as **low confidence** / **non-contract**
- [ ] Do not update resolved layer or matrix from debug text alone

---

## Related observation paths

| Mechanism | What it observes | S0 task |
|-----------|------------------|---------|
| Agent SDK `mcpServerStatus()` | MCP tool list (structural) | S0-01 |
| `PreToolUse` hook | Tool invocations | S0-03 |
| `SubagentStart` hook | Subagent type at spawn | S0-02 |
| `stream-json` + hook events | Structured `-p` stream | Alternative to debug scrape — still not scan-wired |
| **`claude -p --debug`** | **Internal diagnostics** | **S0-04 (defer)** |

Full structured report: [docs/tasks/S0-04-findings.md](../../../../docs/tasks/S0-04-findings.md)

---

## Safety (SPEC §9.4)

| Rule | This probe |
|------|------------|
| Fixture projects only | Yes — `tests/fixtures/claude/*/project` |
| Developer/test mode | Manual CLI only |
| No scan integration | Documentation only; no parser module |
| Process isolation + timeout | Operator responsibility if running `-p` |
| No third-party MCP without approval | Use fixture MCP config only |
| Observations ≠ configuration | Debug text is diagnostic, not config truth |
