# Capsight Roadmap

Contract: [SPEC.md](./SPEC.md) · Backlog: [TASKS.md](./TASKS.md) · Workflow: [DEVELOPMENT.md](./DEVELOPMENT.md)

## Current focus

**H1 — Correctness hardening.** M0–M3 feature work is complete, but an audit of `aa7f109` against SPEC §0.1, §8, §11 and §13 found defects that block a v0.1 release. Start at [H1-01](tasks/H1-01-secret-redaction.md) and follow the order in [TASKS.md](./TASKS.md).

## Phase status

| Phase | Status | Gate |
|-------|--------|------|
| I0 — Process setup | `done` | All I0 tasks done |
| S0 — Runtime observation spike | `done` | [S0-DECISION.md](./S0-DECISION.md) |
| M0 — Discovery Viewer | `done` | SPEC §10 Acceptance M0 |
| M1 — Resolver + Explainability | `done` | M1-15 correctness gate |
| M2 — Probe, Graph, Simulation | `done` | M2-06 complete |
| M3 — Editor (v0.2) | `done` | M3-03 complete |
| H1 — Correctness hardening | `in_progress` | H1-01..H1-04 closed + §11.3 gate real |

## Known deviations (H1)

Milestone tasks are `done` as scoped, but these SPEC requirements are not met on `aa7f109`. Until H1-01..H1-04 close, the product can return confident wrong answers, which SPEC §0.1.2 calls a critical defect.

| # | Deviation | Spec | Task |
|---|-----------|------|------|
| 1 | Raw inline MCP `env`, `hooks`, `unknownFields` leave discovery verbatim into API, CLI stdout and M3 backups | §0.1.8, §12.6, inv 10 | H1-01 |
| 2 | `tools` whose patterns all fail to parse disables the whitelist — whole parent pool reported `available`/`enforced` | §0.1.2, inv 4 | H1-02 |
| 3 | Trust has no `unknown` state: unreadable `~/.claude.json` → `blocked`; `unknown` reason paired with `available` | §7.2, inv 4 | H1-03 |
| 4 | `lookupFeature` has no production caller; enforcement is hardcoded and degraded mode never downgrades | §8.2, §8.3, inv 11 | H1-04 |
| 5 | `facts.ts` holds 12 bare constants; `[doc]`/`[ext]`/`[spike]` trust levels not modelled | §3, §8.2 | H1-05 |
| 6 | Trust, skills, instructions, builtin and plugin rules emit `enforced` with no matrix entry; `agent.depthLimit` names an empty fixture | §8.2, §0.1.3 | H1-06 |
| 7 | Golden runner selects fixtures by `existsSync(expected.json)`; the corpus-completeness test is a tautology over that same filter | §11.1, §11.3 | H1-07 |
| 8 | Coverage denominator is 12 registered facts, not the §3 list — reports ~92% against ~13% real coverage | §11.4 | H1-08 |
| 9 | 12 of 20 fixtures empty; `managed-simulation` has no `expected.json` | §11.1 | H1-09, H1-10, H1-11 |
| 10 | `src/core/` contains the Claude frontmatter schema, builtin tool tables, permission modes and `CLAUDE_CODE_*` env name | §12.2, inv 1 | H1-12 |
| 11 | `DiscoveredMcpServer` lacks `name`, `definitionKind`, `configHash`; `probe-mcp <name>` cannot address a server | §5, §12.5 | H1-13 |
| 12 | CLI missing `explain` and `warnings` from §12.5 | §12.5 | H1-14 |
| 13 | Probe passes full `process.env` to the child, SIGTERM only, unredacted argv, caches failed runs | §9.4, §7.9 | H1-15 |

Audited and confirmed clean: probe confirmation gate (§7.9, inv 9), no third-party execution on scan beyond `claude --version` (inv 8, M0 #7), no writes outside M3 apply and `.agent-manager/cache/` (inv 6), backup before mutation (inv 7), probe cache and environment handling store key names only (inv 10 on those paths), no version comparison outside `adapters/claude/version/` (inv 11), collision and invalid-file discovery (A1, A3, A4, A7), `unknownRate` surfaced per project (inv 13).

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

Settings-permission precedence (S1–S8) and skill overrides (K8, K10–K12) are unimplemented; H1-10 records them as honest `unknown` in the goldens first.

Live runtime observation layer if platform APIs mature (revisit S0).
