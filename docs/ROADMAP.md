# Capsight Roadmap

Contract: [SPEC.md](./SPEC.md) · Backlog: [TASKS.md](./TASKS.md) · Workflow: [DEVELOPMENT.md](./DEVELOPMENT.md)

## Current focus

**All roadmap phases complete.** Next: expand fixture corpus (§11.1 remaining fixtures) and harden against real Claude Code projects.

## Phase status

| Phase | Status | Gate |
|-------|--------|------|
| I0 — Process setup | `done` | All I0 tasks done |
| S0 — Runtime observation spike | `done` | [S0-DECISION.md](./S0-DECISION.md) |
| M0 — Discovery Viewer | `done` | SPEC §10 Acceptance M0 |
| M1 — Resolver + Explainability | `done` | M1-15 correctness gate |
| M2 — Probe, Graph, Simulation | `done` | M2-06 complete |
| M3 — Editor (v0.2) | `done` | M3-03 complete |

## S0 outcome

| Field | Value |
|-------|-------|
| observed-layer | `no` |
| decision doc | [S0-DECISION.md](./S0-DECISION.md) |

Correctness gate uses **fixture-only** verification per S0 fallback.

## Milestone acceptance (pointers)

See [SPEC.md §10](./SPEC.md#10-milestones).

- **M0:** discovery viewer, CLI, API, UI — read-only scan
- **M1:** resolver, context selector, Why panel, golden fixtures, correctness gate
- **M2:** MCP probe, security findings, budget, simulation, graph
- **M3:** in-memory editor, plan/diff, backup, apply, rollback

## Post-v0.1 backlog (not started)

Remaining SPEC fixture corpus (§11.1): nested-project, collision-nested, collision-same-dir, invalid-agents, plugin-agents, depth-limit, settings-permissions, skill-allowed-tools, instructions, environment, add-dir, version-drift.

Live runtime observation layer if platform APIs mature (revisit S0).
