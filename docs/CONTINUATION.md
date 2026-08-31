# Capsight continuation

**Active phase:** S9P — Observed partial (invocation-only)  
**Next task:** S9P-01 (in progress)

## Phase queue

```
S9P-01 → S9P-02 → S9P-03 → S9P-04 → S9P-05 → S9P-06 → S9P-07
```

## Goal

Unlock §9 partial path: live probe infrastructure + invocation-only UX contract + dev-only observe CLI/UI. Structural `resolved != observed` (S9-04) stays cancelled.

## Handoffs

| Task | Handoff |
|------|---------|
| S9P-01 | `docs/tasks/S9P-01-live-probe-harness.md` |
| S9P-02 | `docs/tasks/S9P-02-invocation-only-contract.md` |
| S9P-03 | `docs/tasks/S9P-03-observed-capability-model.md` |
| S9P-04 | `docs/tasks/S9P-04-observe-cli.md` |
| S9P-05 | `docs/tasks/S9P-05-invocation-collector.md` |
| S9P-06 | `docs/tasks/S9P-06-observed-ui.md` |
| S9P-07 | `docs/tasks/S9P-07-phase-gate.md` |

## Orchestration

Autonomous loop: implementer → reviewer → tests → mark done → next task.
