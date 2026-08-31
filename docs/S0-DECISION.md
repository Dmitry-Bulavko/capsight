# S0 decision: observed layer in v0.1

**Date:** 2026-08-28  
**Task:** [S0-05](tasks/S0-05-decision.md)  
**Spec:** [SPEC §9.5](SPEC.md#95-fallback-при-провале-спайка)

## Decision

| Field | Value |
|-------|-------|
| **observed-layer** | **no** |
| **Outcome** | Fallback per SPEC §9.5 — standard path, not project failure |
| **Max matrix confidence (v0.1)** | `"fixture"` |
| **Correctness gate (§11.3)** | Fixture-only (no runtime observation arm) |

---

## Rationale

S0 spike order (§9.2) was exhausted within the 5-day time-box. Documentation review (no live fixture probes run per §9.4) shows no single probe — and no combination — yields a permission-resolved effective tool pool suitable for the `resolved != observed` adapter contract.

### S0-01 — Agent SDK: partial, inconclusive

[Findings](tasks/S0-01-findings.md)

| Probe | Result |
|-------|--------|
| Unified “list all resolved tools” API | **Not available** |
| MCP inventory via `mcpServerStatus()` | Partial — MCP-origin tools only |
| Built-in / deferred tools via `getContextUsage()` | Indirect, incomplete; Claude Code often omits optional fields |
| Permission-filtered effective pool | **Not exposed** structurally |
| Live fixture probe | **Not run** (dev-only policy) |

**Impact:** SDK exposes **fragments**, not the resolved pool snapshot Capsight needs. Cannot alone populate `ObservedCapability` or support `resolved != observed` without heavy subprocess + credentials on a non-scan path. Verdict: **partially available / inconclusive** — insufficient for v0.1 observed layer.

### S0-02 — SubagentStart hook: not useful for tool composition

[Findings](tasks/S0-02-findings.md)

| Field | Tool-composition relevance |
|-------|--------------------------|
| `agent_type`, `agent_id` | Identity only — confirms subagent spawn |
| `tools`, `disallowedTools`, MCP inventory | **Not in payload** |

**Impact:** Cannot observe resolved tool set at subagent spawn. At best correlates spawn identity with declared/resolved layers or stitches `PreToolUse` events — neither closes the pool gap. Verdict: **not useful** for observed tool-composition layer.

### S0-03 — PreToolUse hook: one-sided invocation only

[Findings](tasks/S0-03-findings.md)

| Capability | Result |
|------------|--------|
| Positive `observedStatus: "available"` per invoked tool | **Yes** — high confidence |
| Full effective tool pool at session start | **No** |
| Infer `denied` from hook silence | **Invalid** (§9.3) |
| Full capability matrix from passive logging | **Incomplete** by design |

**Impact:** Best passive path for **invocation-side** evidence, but observation is **one-sided**: uncalled tools remain `not-observed`, never proof of denial. Cannot enumerate the resolved pool or satisfy structural `resolved != observed` comparison across the matrix. Verdict: **useful for invocations, insufficient alone for v0.1 observed layer**.

### S0-04 — `claude -p --debug`: deferred

[Findings](tasks/S0-04-findings.md)

| Aspect | Result |
|--------|--------|
| Structured, stable log schema | **No** — non-contract, release-fragile |
| Tool-pool inventory | **Unreliable** — incidental log lines |
| Redundant vs S0-01 / S0-03 | **Yes** for any positive signal |
| v0.1 implementation | **Defer** — document only |

**Impact:** Last-resort probe does not close the resolved-pool gap; adds maintenance and safety risk (§9.4) without exceeding hook/SDK value. Verdict: **document and defer**; does not rescue observed layer for v0.1.

### Combined assessment

| Layer need | S0 coverage |
|------------|-------------|
| Declared | Scan (M0+) — unaffected |
| Resolved | Resolver (M1) — unaffected |
| Observed (structural pool) | **No probe delivers** |
| Observed (invocation-only, one-sided) | PreToolUse partial — **insufficient for product contract** |
| `resolved != observed` gate | **Not implementable** without structural pool |

**Conclusion:** Fallback per §9.5. Probing artifacts under `src/adapters/claude/probing/` remain for future manual/dev use; they are **not** wired to scan.

---

## v0.1 exclusions (§9.5)

The following are **out of scope** for v0.1 implementation:

### Spec / model

- SPEC §9 runtime observation layer (`DECLARED` / `RESOLVED` / **`OBSERVED`**)
- `ObservedCapability` interface and any emission/storage of observed capabilities
- `observedStatus`, `evidenceKind: "tool-invoked" | "permission-denied" | "absence"` on capability records
- `source: "agent-sdk" | "hook" | "debug-log"` as product evidence channels
- `confidence: "runtime-observed"` in version matrix entries (type may remain in schema for forward compatibility; **must not be assigned** in v0.1)
- `resolved != observed` adapter defect detection and related warnings/UI
- Active permission-denial harness (`observedStatus: "denied"`) — already excluded by §9.3 for v0.1

### Runtime / CLI

- `agent-manager observe --fixture <name>` as a product command (SPEC §12.4 — S0/dev only; **no M1+ wiring**)
- Automatic or scan-path Agent SDK subprocess probes
- Hook log ingestion on user projects
- Debug-log parser and `--debug` scrape in scan or CI
- Coverage metric bucket `runtime-observed` in CI reports (§11.4) — report **0** / omit bucket for v0.1

### Acceptance / gates

- Correctness gate (§11.3) **runtime-observation arm** — see M1 implications below
- M1 acceptance items that assume runtime verification of resolver output (replaced per §9.5)

### Retained (dev-only, not product)

- Spike scripts and notes: `src/adapters/claude/probing/*`
- Manual fixture probes per §9.4 when developers choose to re-run S0

---

## Evidence and confidence (v0.1)

Per §9.5 fallback:

| Setting | v0.1 value |
|---------|------------|
| Allowed evidence sources | `documentation` \| `fixture` \| `code-inspection` |
| Max matrix `confidence` | **`fixture`** |
| `[ext]` facts in confident outputs | Require `confidence >= "fixture"` (§8) — unchanged |
| `[doc]` facts | `confidence: "doc"` — unchanged |

No scan or CI run may spawn Claude Code for observation except existing **`claude --version`** (M0 invariant).

---

## Implications for M1 acceptance

M1 may proceed after this document is recorded (orchestrator updates ROADMAP `observed-layer` field).

### Correctness gate (§11.3) — fixture-only

**Blocking criterion (v0.1):**

> No confident resolver assertion contradicts **golden fixture expectation** (`expected.json`).

The §11.3 phrase “or runtime-observation” is **inactive** for v0.1. Golden tests under `tests/fixtures/claude/` are the sole blocking correctness source.

| Gate arm | v0.1 |
|----------|------|
| Fixture golden (`expected.json`) | **Active** — blocks release on mismatch |
| Runtime observation | **Excluded** |

`unknown` in resolver output remains non-blocking. Confident wrong answers against fixtures block release.

### Acceptance M1 — explicit mapping

SPEC §9.5: *“Acceptance M1 пункты про runtime observation заменяются на coverage-by-documentation.”*

| SPEC Acceptance M1 | v0.1 under fallback |
|--------------------|---------------------|
| 1. Every capability has ≥1 source and ≥1 reason | **Unchanged** |
| 2. Context change affects result; foreground/background/fork/explore differ | **Unchanged** |
| 3. `fork` does not apply agent config; explains why (T3) | **Unchanged** |
| 4. Declared vs effective `permissionMode`; parent `auto` (P2) | **Unchanged** |
| 5. Explore/Plan show 0 instruction sources (I2) | **Unchanged** |
| 6. Plugin agent ineffective fields (F9) | **Unchanged** |
| 7. `blocked_by_trust` only R1/R5 | **Unchanged** |
| 8. Depth limit affects `Agent` (N2) | **Unchanged** |
| 9. All `[ext]` facts in confident outputs have fixture | **Unchanged** — primary enforcement path |
| 10. No confident assertion contradicts fixture corpus | **Unchanged** — **this is the correctness gate** |
| 11. `unknownRate` shown for user project | **Unchanged** |
| *(implicit)* Runtime `resolved == observed` | **Removed** — not applicable |
| *(implicit)* `runtime-observed` confidence promotion | **Removed** — cap at `fixture` |

**Coverage-by-documentation:** Where observation would have upgraded confidence, v0.1 relies on documented behavior + fixture verification. Gaps without fixtures stay `unknown` or documentation-only — not silently promoted.

### M3 / apply messaging (forward reference)

SPEC M3 acceptance #5–6: apply confirmation must state runtime behavior is **not independently verified** when observation layer is absent. This decision **confirms** that wording applies through v0.1 (and until a future observed layer ships).

### CI coverage report (§11.4)

For v0.1 CI, report:

```
fixture-verified    : M
documentation-only  : K
unverified          : L
```

Do **not** require or expect `runtime-observed : N` > 0. Product UI continues to show per-project `unknownRate` only.

### M1 task scope guardrails

- **In:** ExecutionContext, resolver §4.4, explainability, version matrix (fixture-capped), fixture expansion, golden tests
- **Out:** ObservedCapability pipeline, hook/SDK integration on scan, observation CLI, debug parser, `resolved != observed` checks

---

## Revisit criteria (post–v0.1)

Re-open observed layer only if **all** are true:

1. Agent SDK or hooks expose **structural** permission-resolved tool pool (or documented equivalent), **or** product accepts invocation-only matrix with explicit one-sided UX
2. Live fixture probes validate payloads across supported Claude Code versions
3. §9.4 safety model preserved (fixture/dev-only, no user-project auto-probe)
4. New S0 spike or S0-05 revision documented before M1+ observation work

Until then, §9.5 fallback stands.

---

## Revisit (S9-01)

**Date:** 2026-08-31  
**Verdict:** **remain deferred** — §9.5 fallback unchanged.

[S9-DECISION.md](S9-DECISION.md) re-assessed all four criteria against Agent SDK v0.3.252 and current hooks documentation. No structural permission-resolved tool-pool API; live fixture probes still not run (criterion 2 fail). Nearest future path: **invocation-only partial** after fixture validation.

---

## References

| Artifact | Path |
|----------|------|
| S0-01 findings | [tasks/S0-01-findings.md](tasks/S0-01-findings.md) |
| S0-02 findings | [tasks/S0-02-findings.md](tasks/S0-02-findings.md) |
| S0-03 findings | [tasks/S0-03-findings.md](tasks/S0-03-findings.md) |
| S0-04 findings | [tasks/S0-04-findings.md](tasks/S0-04-findings.md) |
| SPEC §9 | [SPEC.md §9](SPEC.md#9-runtime-observation-spike-s0) |
| SPEC §9.5 fallback | [SPEC.md §9.5](SPEC.md#95-fallback-при-провале-спайка) |
| SPEC §11.3 gate | [SPEC.md §11.3](SPEC.md#113-correctness-gate) |
| Acceptance M1 | [SPEC.md M1](SPEC.md#m1--resolver--explainability) |
