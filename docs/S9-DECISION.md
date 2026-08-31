# S9 decision: observed layer revisit (S9-01)

**Date:** 2026-08-31  
**Task:** [S9-01](tasks/S9-01-s0-revisit.md)  
**Baseline:** [S0-DECISION.md](S0-DECISION.md) (2026-08-28, observed-layer: **no**)  
**Spec:** [SPEC §9.1–§9.5](SPEC.md#9-runtime-observation-spike-s0)

## Verdict

| Field | Value |
|-------|-------|
| **observed-layer (S9)** | **remain deferred** |
| **S0-DECISION §9.5 fallback** | **unchanged** — continues through v0.1+ until all revisit criteria pass |
| **Max matrix confidence** | **`fixture`** (unchanged) |
| **Nearest viable path** | **invocation-only partial** — if live fixture probes validate (criterion 2) |

**Summary:** Documentation review of Agent SDK v0.3.252 and current hooks (2026-08-31) shows **no new structural permission-resolved tool-pool API**. Fragment introspection (`mcpServerStatus`, init `tools[]`, `getContextUsage`) remains incomplete for the `resolved != observed` contract. Invocation-side hooks (`PreToolUse`, `PermissionDenied`) are documented and viable for a one-sided matrix, but **live fixture probes were not run** — criterion 2 fails. §9.5 fallback stands; S9-02+ product work remains blocked.

---

## Revisit criteria assessment

S0-DECISION requires **all four** criteria before re-opening the observed layer.

### Criterion 1 — Structural pool **or** invocation-only UX acceptance

> Agent SDK or hooks expose **structural** permission-resolved tool pool (or documented equivalent), **or** product accepts invocation-only matrix with explicit one-sided UX.

| Branch | Assessment | Confidence |
|--------|------------|------------|
| Structural permission-resolved pool | **Not satisfied** | high (docs) |
| Invocation-only with one-sided UX | **Docs support it; product not committed** | medium-high (docs) |

**Evidence (2026-08-31):**

#### Agent SDK (`@anthropic-ai/claude-agent-sdk` v0.3.252)

| Probe | S0-01 (2026-08-28) | S9-01 (2026-08-31) | Change |
|-------|--------------------|--------------------|--------|
| Unified `supportedTools()` / effective-pool API | Not available | **Not available** | none |
| `Query.mcpServerStatus()` → per-server `tools[]` | Partial — MCP only | **Unchanged** — MCP-origin tools with name/description/annotations; statuses include `connected`, `pending`, `needs-auth`, `failed`, `disabled` | none material |
| `Query.getContextUsage()` → built-in/deferred names | Partial; optional fields often absent | **Unchanged** — docs still state: *"Claude Code leaves the optional `deferredBuiltinTools`, `systemTools`, and `systemPromptSections` diagnostics unset, so expect them to be absent"* ([Agent SDK TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript), reviewed 2026-08-31) | none |
| `SDKSystemMessage` init `tools: string[]` | Not assessed in S0-01 findings | **Partial structural** — wire tool names at session init; **not documented** as permission-resolved effective pool; MCP tools may be absent while servers are `pending` ([MCP SDK guide](https://code.claude.com/docs/en/agent-sdk/mcp), reviewed 2026-08-31) | noted, insufficient |
| Input-side `tools` / `disallowedTools` / `allowedTools` | Write-only config | **Unchanged** — no read-back of merged effective set | none |
| `permission_denials` on `SDKResultMessage`; `SDKPermissionDeniedMessage` stream | Not in S0-01 scope | **Event-side denial evidence** — per-denial `tool_name`/`tool_input`; authoritative over stream event; still not pool enumeration | incremental |

**SDK version delta:** npm latest `0.3.252` (modified 2026-08-31) vs S0 baseline `0.3.250` — two patch releases; no new pool-listing API in TypeScript reference.

#### SubagentStart hook

| Field | S0-02 (2026-08-28) | S9-01 (2026-08-31) | Change |
|-------|--------------------|--------------------|--------|
| `agent_type`, `agent_id` | Present | **Present** | none |
| Tool list / MCP inventory / permission allowlist | Not in payload | **Not in payload** — official schema still common fields + `agent_id` + `agent_type` only ([Hooks reference — SubagentStart](https://code.claude.com/docs/en/hooks#subagentstart), reviewed 2026-08-31) | none |

#### PreToolUse hook (+ PermissionDenied)

| Capability | S0-03 (2026-08-28) | S9-01 (2026-08-31) | Change |
|------------|--------------------|--------------------|--------|
| Positive `observedStatus: "available"` per invoked tool | Yes | **Yes** — unchanged | none |
| Full effective pool at session start | No | **No** | none |
| Infer `denied` from hook silence | Invalid (§9.3) | **Invalid** — unchanged | none |
| `PermissionDenied` hook (auto-mode denials) | Mentioned indirectly | **Documented** — fires on auto-mode denials with `tool_name`, `tool_input`, `reason`; does **not** fire for manual prompt denials or `PreToolUse` blocks ([Hooks reference — PermissionDenied](https://code.claude.com/docs/en/hooks#permissiondenied), reviewed 2026-08-31) | docs expanded |
| Active denial harness for v0.1 | Out of scope (§9.3) | **Still out of scope** — PermissionDenied is passive observation of denials that occur, not deterministic matrix coverage | unchanged policy |

#### `claude -p --debug`

| Aspect | S0-04 (2026-08-28) | S9-01 (2026-08-31) | Change |
|--------|--------------------|--------------------|--------|
| Structured stable schema | No | **No** | none |
| Tool-pool inventory | Unreliable | **Unreliable** | none |
| Redundant vs SDK/hooks | Yes | **Yes** — `--include-hook-events` on `stream-json` remains session-bound, not a capability-matrix contract | none |

**Criterion 1 conclusion:** **Not fully satisfied.** Structural branch fails (same gap as S0). Invocation-only branch is **documented and technically plausible** (PreToolUse + PermissionDenied + SDK denial records) but Capsight has not yet productized one-sided UX; that is a separate product decision, not an API maturity unlock. **Alone, criterion 1 does not clear the bar for go.**

---

### Criterion 2 — Live fixture probes across supported Claude Code versions

> Live fixture probes validate payloads across supported Claude Code versions.

| Item | Status | Evidence |
|------|--------|----------|
| `agent-sdk-spike.ts` against `tests/fixtures/claude/*` | **Not run** | Same §9.4 policy as S0; spike stub at `src/adapters/claude/probing/agent-sdk-spike.ts` |
| SubagentStart / PreToolUse hook loggers on fixtures | **Not run** | Example configs in `src/adapters/claude/probing/hooks-*.md` |
| `claude -p --debug` capture | **Not run** | Notes in `src/adapters/claude/probing/debug-log-notes.md` |
| Cross-version payload validation | **Not done** | Doc review only; no recorded payloads for 0.3.252 or post–2026-08-28 Claude Code |

**Criterion 2 conclusion:** **Fail.** Same blocker as S0. Doc deltas (e.g. PermissionDenied schema, init `tools[]` semantics) are **unverified** against fixtures.

---

### Criterion 3 — §9.4 safety model preserved

> §9.4 safety model preserved (fixture/dev-only, no user-project auto-probe).

| Rule | S9 assessment |
|------|---------------|
| Fixture projects only | **Preservable** — existing probing README and spike scripts enforce `--fixture` |
| Explicit developer/test mode | **Preservable** — manual `npx tsx` / hook install; no scan wiring |
| No auto-probe on user projects | **Preservable** — probing modules not imported by scan/CLI |
| Process isolation + timeout | **Preservable** — spike uses AbortController + 120s cap |
| No third-party MCP without approval | **Preservable** — `strictMcpConfig: true` in spike |
| Observations ≠ configuration | **Preservable** — evidence tagging unchanged |

**Criterion 3 conclusion:** **Pass** (design-level; no product regression introduced by this assessment).

---

### Criterion 4 — Spike / decision revision before M1+ observation work

> New S0 spike or S0-05 revision documented before M1+ observation work.

| Item | Status |
|------|--------|
| S9-DECISION.md (this document) | **Complete** — dated 2026-08-31 |
| S0-DECISION addendum | **Complete** — links here |
| Updated probe findings files | **Not required for defer verdict** — doc-only revisit |

**Criterion 4 conclusion:** **Pass** for documentation gate; does not override criteria 1–2 failure.

---

## Combined gate

| Criterion | Result |
|-----------|--------|
| 1. Structural pool or invocation-only UX | **Partial** — invocation-only docs OK; structural no; product UX not committed |
| 2. Live fixture probes | **Fail** |
| 3. §9.4 safety | **Pass** |
| 4. Documented spike revision | **Pass** |

**All four required → observed layer remains deferred.**

---

## What would need to change (next revisit)

1. **Platform (either):**
   - A documented API returning the **permission-resolved effective tool pool** (built-ins + MCP + agent-scoped filters) in one query; **or**
   - Capsight product sign-off on **invocation-only** observed matrix with explicit one-sided UX (§9.3 semantics surfaced in UI).

2. **Live validation (mandatory):**
   - Run `agent-sdk-spike.ts` and hook loggers on representative fixtures; record payloads for at least two Claude Code versions in the supported matrix.
   - Confirm init `tools[]`, `mcpServerStatus().tools[]`, and `getContextUsage()` field population against resolver output.
   - Optionally capture one `--debug-file` sample for human triage only (still `confidence: low`).

3. **If invocation-only go (without structural pool):**
   - Accept that `resolved != observed` **structural** comparison stays limited — S9-04 (full gate) remains blocked; only invoked-tool defects detectable.
   - Document `PermissionDenied` coverage limits (auto-mode only; no manual-deny path).

4. **If structural pool appears:**
   - Re-assess S9-04 scope and correctness gate §11.3 runtime arm.

---

## Conditional S9-02+ sequence (if a future revisit returns go)

*Titles only — not authorized while verdict is **remain deferred**.*

| Task | Title | Condition |
|------|-------|-----------|
| S9-02 | ObservedCapability core model | go (full or partial) |
| S9-03 | Dev-only observation probe harness | go (full or partial) |
| S9-04 | `resolved != observed` detection + warnings | **full only** |
| S9-05 | UI — observed status in capabilities / Why | go (full or partial); one-sided UX if partial |
| S9-06 | Coverage gate — runtime-observed bucket | go (full or partial) |
| S9-07 | S9 phase gate | go (full or partial) |

---

## Implications (unchanged from S0)

- §9.5 fallback and fixture-capped confidence remain active.
- Correctness gate §11.3: **fixture-only** blocking arm.
- D5's 18 unverified facts stay at honest ceiling until observation layer or new platform facts.
- Probing artifacts under `src/adapters/claude/probing/` remain dev-only; not scan-wired.

---

## Partial go addendum (S9P-02)

**Date:** 2026-08-31  
**Task:** [S9P-02-invocation-only-contract.md](tasks/S9P-02-invocation-only-contract.md)  
**Contract:** [S9P-UX-CONTRACT.md](S9P-UX-CONTRACT.md)

### Verdict change (narrow)

| Field | S9-01 | S9P-02 addendum |
|-------|-------|-----------------|
| Full observed layer (S9-02–S9-07) | remain deferred | **unchanged — remain deferred** |
| Invocation-only partial (S9P) | not authorized | **authorized — S9P-03+** |
| Criterion 1 — invocation-only UX | product not committed | **committed** via [S9P-UX-CONTRACT.md](S9P-UX-CONTRACT.md) |
| Criterion 1 — structural pool | not satisfied | **unchanged — not satisfied** |

### Criterion 1 update

The **invocation-only branch** of criterion 1 is now **satisfied**: Capsight product sign-off on a one-sided observed matrix with explicit UX semantics (§9.3 surfaced in UI per contract). The **structural pool branch** remains failed; S9-04 (`resolved != observed` structural gate) stays **cancelled**.

### Authorized work (S9P-03+)

| Task | Title | Condition |
|------|-------|-----------|
| S9P-03 | ObservedCapability core model | authorized |
| S9P-04 | Dev-only observe CLI | authorized |
| S9P-05 | Invocation-side observation collector | authorized |
| S9P-06 | UI — one-sided observed status | authorized — must follow S9P-UX-CONTRACT |
| S9P-07 | S9P phase gate | authorized |

**Still blocked:** S9-02–S9-07 full sequence; S9-04 structural comparison; scan-path auto-observation.

### Prerequisites met

| Prerequisite | Status |
|--------------|--------|
| S9P-01 probe harness + fixture payload infrastructure | done — [S9P-PROBE-FINDINGS.md](S9P-PROBE-FINDINGS.md) |
| S9P-02 invocation-only UX contract | done — [S9P-UX-CONTRACT.md](S9P-UX-CONTRACT.md) |

### S9P partial gate (criterion mapping)

| Criterion | S9P partial status |
|-----------|-------------------|
| 1. Invocation-only UX acceptance | **Pass** (S9P-02) |
| 2. Live fixture probes | **Partial** — harness + doc-derived payload (S9P-01); live re-run when credentials available |
| 3. §9.4 safety | **Pass** |
| 4. Documented revision | **Pass** |

S9P partial path proceeds; full §9 reopen still requires structural pool or a future comprehensive revisit.

---

## References

| Artifact | Path |
|----------|------|
| S0 decision | [S0-DECISION.md](S0-DECISION.md) |
| S9P UX contract | [S9P-UX-CONTRACT.md](S9P-UX-CONTRACT.md) |
| S9P probe findings | [S9P-PROBE-FINDINGS.md](S9P-PROBE-FINDINGS.md) |
| S0-01 findings | [tasks/S0-01-findings.md](tasks/S0-01-findings.md) |
| S0-02 findings | [tasks/S0-02-findings.md](tasks/S0-02-findings.md) |
| S0-03 findings | [tasks/S0-03-findings.md](tasks/S0-03-findings.md) |
| S0-04 findings | [tasks/S0-04-findings.md](tasks/S0-04-findings.md) |
| Agent SDK TS reference | https://code.claude.com/docs/en/agent-sdk/typescript (reviewed 2026-08-31) |
| Hooks reference | https://code.claude.com/docs/en/hooks (reviewed 2026-08-31) |
| MCP SDK guide | https://code.claude.com/docs/en/agent-sdk/mcp (reviewed 2026-08-31) |
| npm `@anthropic-ai/claude-agent-sdk` | v0.3.252 (2026-08-31) |
