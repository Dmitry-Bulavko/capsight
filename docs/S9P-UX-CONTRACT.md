# S9P UX contract: invocation-only observed layer

**Date:** 2026-08-31  
**Task:** [S9P-02-invocation-only-contract.md](tasks/S9P-02-invocation-only-contract.md)  
**Spec:** [SPEC §9.3](SPEC.md#93-фундаментальное-ограничение)  
**Decision:** [S9-DECISION.md](S9-DECISION.md) criterion 1 (invocation-only branch)

## Product commitment

Capsight adopts an **invocation-only** observed layer for the S9P partial path. Runtime evidence records tools the agent **actually invoked** or **explicitly had denied** during a dev-only observation session. Absence of invocation is **not** evidence of prohibition.

This contract enables S9P-03+ (core model, collector, UI) **without** a structural permission-resolved tool-pool API. Structural `resolved != observed` comparison (S9-04) remains **cancelled**.

---

## One-sided semantics (SPEC §9.3)

Observation is **one-sided**. PreToolUse and related hooks record only tools that were called. Silence does not prove denial.

| `observedStatus` | Meaning | Required evidence |
|------------------|---------|-------------------|
| `available` | Tool was invoked at runtime | `evidenceKind: "tool-invoked"` (e.g. PreToolUse `tool_name`) |
| `not-observed` | No invocation evidence for this capability in the session | `evidenceKind: "absence"` — default for uncalled tools |
| `denied` | Agent attempted invocation and received an explicit refusal | `evidenceKind: "permission-denied"` from a denial event |

### Mandatory invariants

1. **`available` = invoked** — positive evidence only; never infer from pool listing, config, or resolver output.
2. **`not-observed` ≠ `denied`** — never promote absence to denial; never display or store `not-observed` as "blocked" or "forbidden".
3. **`denied` requires an explicit denial event** — attempted call plus captured refusal (`PermissionDenied` hook, SDK `permission_denials` / `SDKPermissionDeniedMessage`). Hook silence, resolver `denied`, or config `disallowedTools` alone are **not** observed denial.
4. **No active denial harness in v0.1** — Capsight passively records denials that occur during observation; it does not drive agents to probe every tool for matrix coverage.

```typescript
// Canonical shape — SPEC §9.3; implemented in S9P-03
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

---

## Evidence sources (S9P scope)

| Source | Maps to | Notes |
|--------|---------|-------|
| `PreToolUse` hook | `available` + `tool-invoked` | Primary positive path ([S0-03 findings](tasks/S0-03-findings.md)) |
| `PermissionDenied` hook | `denied` + `permission-denied` | See limits below |
| Agent SDK stream / result `permission_denials` | `denied` + `permission-denied` | Authoritative when present |
| Uncalled tools in observed session | `not-observed` + `absence` | Not a claim about permission |
| Resolver / declared config | *(not observed)* | Stays in resolved layer; do not conflate |

**Out of scope for observed claims:** init `tools[]`, `mcpServerStatus()`, `getContextUsage()` — fragment introspection only; not permission-resolved effective pool ([S9P-PROBE-FINDINGS.md](S9P-PROBE-FINDINGS.md)).

---

## PermissionDenied limits

`PermissionDenied` supplies **opportunistic** denial evidence only. Document and surface these limits in UI copy (S9P-06).

| Aspect | Behavior |
|--------|----------|
| **When it fires** | Auto-mode permission denials during an observation session |
| **When it does not fire** | Manual prompt denials; `PreToolUse` hook blocks; tools never attempted |
| **Coverage** | Not deterministic — absence of a denial event does not mean the tool is allowed |
| **Harness policy** | Passive observation only; no active matrix probe to force denials (SPEC §9.3 v0.1) |

UI must not imply that uncaptured denials are impossible or that the observed matrix is complete.

---

## What Capsight does NOT claim

When showing observed status, Capsight **must not** imply:

- A `not-observed` tool is forbidden, unavailable, or blocked.
- The effective runtime tool pool is fully enumerated.
- Observed `denied` matches resolver `denied` for every capability (only explicit denial events count).
- Manual user denials at permission prompts were captured.
- Observation ran on the user's project during ordinary scan (S9P is dev/fixture-only per §9.4).
- Structural `resolved != observed` defects are detected for tools that were never invoked (S9-04 cancelled).

**Valid positive claims:**

- "This tool was invoked during the observation session" (`available`).
- "A denial event was recorded for this tool" (`denied`, with auto-mode caveat).
- "No invocation was observed for this tool in this session" (`not-observed`).

---

## UI copy rules (S9P-06)

Apply wherever observed evidence appears (capabilities list, Why panel per §7.5, dev observe output).

### Status labels

| `observedStatus` | Recommended label | Forbidden alternatives |
|------------------|-------------------|------------------------|
| `available` | **Observed: invoked** | "Available", "Allowed" (ambiguous vs resolver) |
| `not-observed` | **Not observed** | "Denied", "Blocked", "Unavailable", "Not allowed" |
| `denied` | **Observed: denied** | Bare "Denied" without observed qualifier |

### Required disclaimer

Show whenever any observed status is visible (inline banner or OBSERVED section footer):

> **Invocation-only observation.** Tools are marked observed only when invoked or explicitly denied during a dev observation session. *Not observed* does not mean denied. Denied status reflects captured denial events (auto-mode only).

### Why panel (§7.5 extension)

Add a distinct **OBSERVED** block below resolved **STATUS** — never merge observed into resolver denial lines:

```
OBSERVED
  Invoked during session     [PreToolUse, 2026-08-31]
  — or —
  Not observed               (no invocation in this session)
  — or —
  Denied (observed)          [PermissionDenied, auto-mode]
```

### Copy tone

- Prefer factual, session-scoped wording ("during this observation session").
- Link or tooltip to this contract for full semantics.
- Do not use checkmarks or red X icons that mirror resolver enforcement for `not-observed`.

---

## Scope boundaries

| In scope (S9P) | Out of scope |
|----------------|--------------|
| Dev-only observe CLI on fixtures (S9P-04) | Ordinary `scan` auto-observation |
| Invocation collector from hooks (S9P-05) | Active denial harness / matrix forcing |
| One-sided UI badge + disclaimer (S9P-06) | S9-04 structural `resolved != observed` gate |
| `ObservedCapability` model (S9P-03) | Writing to scanned project `.claude/**` |

§9.4 safety model unchanged: fixture projects, explicit developer mode, process isolation, no third-party MCP without approval.

---

## Downstream authorization

Implementation tasks **S9P-03 through S9P-07** must conform to this contract. Full S9 sequence (S9-02–S9-07) remains deferred until a broader revisit ([S9-DECISION.md](S9-DECISION.md)).

---

## References

| Artifact | Path |
|----------|------|
| SPEC §9.3 | [SPEC.md §9.3](SPEC.md#93-фундаментальное-ограничение) |
| S9 decision | [S9-DECISION.md](S9-DECISION.md) |
| S9P probe findings | [S9P-PROBE-FINDINGS.md](S9P-PROBE-FINDINGS.md) |
| PreToolUse findings | [tasks/S0-03-findings.md](tasks/S0-03-findings.md) |
| UI task | [tasks/S9P-06-observed-ui.md](tasks/S9P-06-observed-ui.md) |
