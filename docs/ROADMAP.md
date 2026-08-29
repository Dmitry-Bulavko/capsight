# Capsight Roadmap

Contract: [SPEC.md](./SPEC.md) · Backlog: [TASKS.md](./TASKS.md) · Workflow: [DEVELOPMENT.md](./DEVELOPMENT.md)

## Current focus

**V0-01 done** — UI project folder picker shipped. Next: decide follow-ups (H1-29, S6/S7/S11, real-repo audit).

## Phase status

| Phase | Status | Gate |
|-------|--------|------|
| I0 — Process setup | `done` | All I0 tasks done |
| S0 — Runtime observation spike | `done` | [S0-DECISION.md](./S0-DECISION.md) |
| M0 — Discovery Viewer | `done` | SPEC §10 Acceptance M0 |
| M1 — Resolver + Explainability | `done` | M1-15 correctness gate |
| M2 — Probe, Graph, Simulation | `done` | M2-06 complete |
| M3 — Editor (v0.2) | `done` | M3-03 complete |
| H1 — Correctness hardening | `done` | 28 tasks closed; corpus 20/20; H1-29 open as follow-up |
| V0 — v0.1 UX polish | `done` | V0-01 project folder picker |

## H1 outcome

All twenty-eight H1 tasks are closed. The audit of `aa7f109` found thirteen deviations; implementing them surfaced fifteen more, several of the same blocker class as the originals. Everything below is fixed and covered.

| Deviation | Spec | Closed by |
|---|---|---|
| Raw inline MCP `env`, `hooks`, `unknownFields` reached API, CLI and backups | §0.1.8, §12.6, inv 10 | H1-01 |
| `tools` whose patterns all failed to parse opened the whole parent pool | §0.1.2, inv 4 | H1-02 |
| Trust had no `unknown`: an unreadable `~/.claude.json` read as `blocked` | §7.2, inv 4 | H1-03 |
| `lookupFeature` had no caller; enforcement hardcoded; degraded mode inert | §8.2, §8.3, inv 11 | H1-04 |
| `facts.ts` held 12 bare constants; trust levels unmodelled | §3, §8.2 | H1-05 |
| Rules emitted `enforced` with no matrix entry; one named an empty fixture | §8.2, §0.1.3 | H1-06 |
| Golden runner failed open; corpus-completeness test was a tautology | §11.1, §11.3 | H1-07 |
| Coverage denominator was the implementation's own scope | §11.4 | H1-08 |
| 12 of 20 fixtures empty; `managed-simulation` had no `expected.json` | §11.1 | H1-09, H1-10, H1-11 |
| `src/core/` held Claude frontmatter, tool tables and a `CLAUDE_CODE_*` env name | §12.2, inv 1 | H1-12 |
| `McpServer` lacked `name`, `definitionKind`, `configHash`; probe unaddressable by name | §5, §12.5 | H1-13 |
| CLI missing `explain` and `warnings` | §12.5 | H1-14 |
| Probe passed full `process.env`, SIGTERM only, raw argv, cached failed runs | §9.4, §7.9 | H1-15 |
| Nothing recommended ignoring `.agent-manager/` | §12.3 | H1-16 |
| Degraded mode left `status` confident while `enforcement` was unknown | §8.3, §11.3 | H1-17 |
| Five matrix entries covering discovery and simulate were never consulted | §8.2, inv 11 | H1-18 |
| `expandAliases` ignored F11's 2.1.63 boundary | F11, §8.2 | H1-19 |
| An ambiguous agent resolved as if settled; shadowed resolved the loser; invalid resolved as unrestricted | A4, A7, inv 3, 4 | H1-20 |
| Settings `permissions` never reached resolution — §4.4's seventh rule | §4.4, S1–S8, §6 | H1-21 |
| Fixture runs read the developer's own `~/.claude/`; agent picked by walk order | §11.2, inv 2 | H1-22 |
| Plugin agents were never discovered, so F9/A6/A8 were unreachable | A1, A6, A8, F9, M1 #6 | H1-23 |
| CLI and API disagreed on the default context; UI held a third caption | §4.3, §4.1 | H1-24 |
| Probe reaping test flaked under load | §9.4, §11.3 | H1-25 |
| A1 cross-scope shadowing asserted a winner un-gated | A1, §8.2 | H1-26 |
| Security findings contradicted F9 for plugin agents | F9, §7.6, §2.4 | H1-27 |
| `confidence: "fixture"` meant three different things across entries | §8.1, §11.4 | H1-28 |

Suite grew from 240 tests to 467. The §11.1 fixture corpus is complete at 20 of 20 with no pending entries.

Coverage over the fixed §3 denominator ends at **9 fixture-verified / 31 documentation-only / 52 unverified**, from a starting point that *reported* 11 of 12 verified and was really 0 against the true denominator. It peaked at 15 mid-phase and came back down when H1-28 defined what `confidence: "fixture"` admits — the number fell because the criterion got stricter, not because evidence was lost. A maturity metric that can only rise is not measuring anything.

### Still not implemented, and visible as such

- S6 prefix matching and S7 gitignore-glob matching: the rules are recorded and resolve `unknown` rather than being evaluated.
- S11 (`additionalDirectories`, `enableAllProjectMcpServers`).
- The identity of an F8 substitute model, which the simulation still asserts (H1-29).
- The observed layer (§9), excluded from v0.1 by the S0 decision.

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
