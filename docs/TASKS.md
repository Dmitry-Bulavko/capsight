# Capsight Tasks

**Rule:** exactly one task `in_progress` at a time.

Roadmap: [ROADMAP.md](./ROADMAP.md) · Handoff template: [tasks/_TEMPLATE.md](./tasks/_TEMPLATE.md)

## I0 — Process setup

| ID | Phase | Title | Status | Spec refs | Files | Acceptance |
|----|-------|-------|--------|-----------|-------|------------|
| I0-01 | I0 | Create ROADMAP, TASKS, handoff template | done | Plan §1 | docs/ROADMAP.md, docs/TASKS.md, docs/tasks/_TEMPLATE.md | Files exist; backlog populated |
| I0-02 | I0 | Cursor rules (orchestration + adapter) | done | Plan §2 | .cursor/rules/*.mdc | Rules load; alwaysApply set on orchestration |
| I0-03 | I0 | Implementer skill + Claude agent | done | Plan §3 | .cursor/skills/, .claude/agents/ | Skill and agent definitions exist |
| I0-04 | I0 | Smoke: orchestrator delegates via handoff | done | Plan §5 | docs/tasks/I0-04-smoke.md | Subagent completes handoff; TASKS updated |

## S0 — Runtime observation spike

| ID | Phase | Title | Status | Spec refs | Files | Acceptance |
|----|-------|-------|--------|-----------|-------|------------|
| S0-01 | S0 | Agent SDK: tool pool access | done | §9.2 #1 | src/adapters/claude/probing/ | Findings documented in handoff |
| S0-02 | S0 | SubagentStart hook payload | done | §9.2 #2 | src/adapters/claude/probing/ | Payload structure recorded |
| S0-03 | S0 | PreToolUse hook logging | done | §9.2 #3 | src/adapters/claude/probing/ | Invocation log approach documented |
| S0-04 | S0 | claude -p --debug parsing | done | §9.2 #4 | src/adapters/claude/probing/ | Low-confidence approach only if needed |
| S0-05 | S0 | Decision: observed layer yes/no | done | §9.5 | docs/S0-DECISION.md | Gate doc blocks M1 until done |

## M0 — Discovery Viewer

| ID | Phase | Title | Status | Spec refs | Files | Acceptance |
|----|-------|-------|--------|-----------|-------|------------|
| M0-01 | M0 | Detect claude --version + degraded mode | done | §8.3, M0 #2 | src/adapters/claude/version/, src/application/scan.ts | Version or explicit undefined |
| M0-02 | M0 | Project root + upward scope walk | done | A2, M0 #1 | src/adapters/claude/discovery/ | Walk from cwd to repo root |
| M0-03 | M0 | Agent discovery (recursive, all scopes) | done | A1–A6, M0 #3 | src/adapters/claude/discovery/agents.ts | All agents listed with file path |
| M0-04 | M0 | Parse frontmatter + invalid reasons | done | A7, M0 #4 | src/adapters/claude/parsing/ | Invalid files with specific reason |
| M0-05 | M0 | Name collisions: shadowed / ambiguous | done | A3–A4, M0 #5 | src/adapters/claude/discovery/agents.ts | A4 marked ambiguous, no winner |
| M0-06 | M0 | Skills discovery | done | §7.1 | src/adapters/claude/discovery/skills.ts | Skills listed with source |
| M0-07 | M0 | CLAUDE.md / instructions discovery | done | §7.1 | src/adapters/claude/discovery/instructions.ts | Instruction sources listed |
| M0-08 | M0 | MCP config discovery (read-only) | done | §7.1, M0 #7 | src/adapters/claude/discovery/mcp.ts | Servers from config only |
| M0-09 | M0 | Settings layers discovery | done | §7.1 | src/adapters/claude/discovery/settings.ts | Layers with scope |
| M0-10 | M0 | Trust state from ~/.claude.json | done | §7.2 | src/adapters/claude/discovery/trust.ts | Trust read for project path |
| M0-11 | M0 | Assemble ProjectSnapshot + snapshot id | done | §5 | src/application/scan.ts | Snapshot with content hash id |
| M0-12 | M0 | CLI: scan, status, agents | done | §12.5 | src/cli/index.ts | Commands output JSON |
| M0-13 | M0 | API: scan, project, agents | done | §12.4 M0 | src/server/index.ts | M0 routes wired |
| M0-14 | M0 | UI: discovery viewer | done | M0 goal | src/ui/ | Agents, sources, invalid visible |
| M0-15 | M0 | Fixture basic/ + golden test | done | §11.1 | tests/fixtures/claude/basic/ | Golden discovery test passes |

## M1 — Resolver + Explainability

Gate: S0-05 done ✓ · M0 done ✓ · observed-layer: **no** ([S0-DECISION.md](./S0-DECISION.md))

| ID | Phase | Title | Status | Spec refs | Files | Acceptance |
|----|-------|-------|--------|-----------|-------|------------|
| M1-01 | M1 | ExecutionContext presets + builder | done | §4.2, §4.3 | src/core/resolver/context.ts | Presets map to flags |
| M1-02 | M1 | Core filter engine (filters 1 & 2, fork, depth) | done | §4.4, T1–T3, N2 | src/core/resolver/filters.ts | Deterministic filter application |
| M1-03 | M1 | Tool pool resolution (F2, F3, disallowedTools) | done | F2, F3, F4 | src/adapters/claude/resolution/tools.ts | Tools resolved with reasons |
| M1-04 | M1 | Permission mode declared vs effective | done | P1, P2, P4 | src/adapters/claude/resolution/permissions.ts | Parent mode overrides |
| M1-05 | M1 | Version matrix + facts.ts initial corpus | done | §3, §8 | src/adapters/claude/version/ | Matrix entries for M1 rules |
| M1-06 | M1 | Trust + plugin limitations in resolver | done | R1, R5, F9 | src/adapters/claude/resolution/trust.ts | blocked_by_trust scoped correctly |
| M1-07 | M1 | Environment variable normalization | done | §3.11 | src/adapters/claude/environment/ | Key names only, no secrets |
| M1-08 | M1 | resolveEffective application service | done | §7.3 | src/application/resolve.ts | EffectiveConfiguration output |
| M1-09 | M1 | API: effective, explain, warnings | done | §12.4 M1 | src/server/routes/agents.ts | M1 routes wired |
| M1-10 | M1 | Context selector UI | done | §4.3 | src/ui/components/ContextSelector.tsx | Preset changes refetch |
| M1-11 | M1 | Why panel UI | done | §7.5 | src/ui/components/WhyPanel.tsx | Chain with sources/reasons |
| M1-12 | M1 | Golden fixture basic + resolver test | done | §11.1 | tests/fixtures/claude/basic/ | expected.json discovery+resolution |
| M1-13 | M1 | Fixture batch: tools-filters, background, fork | done | §11.1 | tests/fixtures/claude/ | Golden tests pass |
| M1-14 | M1 | Fixture batch: permissions, trust, skills | done | §11.1 | tests/fixtures/claude/ | Golden tests pass |
| M1-15 | M1 | Correctness gate test runner | done | §11.3 | tests/correctness-gate.test.ts | No confident mismatch vs goldens |

## M2 — Probe, Graph, Simulation (stub)

| ID | Phase | Title | Status |
|----|-------|-------|--------|
| M2-01 | M2 | MCP probe with confirmation | done | §7.9 | src/adapters/claude/probing/ | Probe requires confirm |
| M2-02 | M2 | Probe cache invalidation | done | §7.9 | src/adapters/claude/probing/ | Cache invalid on configHash change |
| M2-03 | M2 | Security findings warnings | done | §7.6 | src/adapters/claude/resolution/ | Security warnings emitted |
| M2-04 | M2 | Description budget counter | done | §7.7 A10 | src/adapters/claude/discovery/ | 15k token budget warning |
| M2-05 | M2 | Managed simulation CLI+API | done | §7.8 | src/application/simulate.ts | Delta read-only |
| M2-06 | M2 | Context-aware graph (React Flow) | done | §7.10 | src/ui/components/GraphView.tsx | Graph updates on context change |

## M3 — Editor (stub)

| ID | Phase | Title | Status |
|----|-------|-------|--------|
| M3-01 | M3 | In-memory desired state editor | done | M3 §10 | src/ui/ | Pending edits in memory |
| M3-02 | M3 | Diff planner | done | M3 §10 #2 | src/application/plan.ts | Deterministic diff |
| M3-03 | M3 | Backup + apply + rollback | done | M3 §10 #4-7 | src/adapters/claude/generation/ | Write path with backup |

## H1 — Correctness hardening (pre-v0.1)

Source: audit of `aa7f109` against SPEC §0.1, §8, §11, §13. Gate for v0.1 release — SPEC §0.1.2 and §11.3 are not satisfied while H1-01..H1-04 are open.

Order: H1-01 → H1-02 → H1-03 → H1-05 → H1-06 → H1-04 → H1-07 → H1-08 → H1-09 → H1-10 → H1-11 → rest.

| ID | Phase | Title | Status | Spec refs | Files | Acceptance |
|----|-------|-------|--------|-----------|-------|------------|
| H1-01 | H1 | Secret redaction boundary for snapshot output | done | §0.1.8, §12.6, inv 10 | src/adapters/claude/discovery/agents.ts, snapshot.ts | Inline MCP `env`, `hooks`, `unknownFields` reduced to key names |
| H1-02 | H1 | Unparseable `tools` patterns must not disable whitelist | done | §0.1.2, inv 4, F2–F5 | src/adapters/claude/resolution/tools.ts | Zero parsed patterns → `unknown`, never whole pool `available` |
| H1-03 | H1 | Trust resolution needs an `unknown` state | done | §7.2, R1–R5, inv 4 | src/adapters/claude/{discovery,resolution}/trust.ts | Unreadable trust → `unknown`, not `blocked` |
| H1-04 | H1 | Wire version matrix into enforcement + degraded mode | done | §8.2, §8.3, inv 11 | src/adapters/claude/version/, resolution/ | `lookupFeature` drives enforcement; `version: unknown` degrades |
| H1-05 | H1 | facts.ts — real fact registry with trust levels | done | §3, §0.1.1, §8.2 | src/adapters/claude/version/facts.ts | All used facts registered with doc/ext/spike |
| H1-06 | H1 | Matrix entries for rules that already emit `enforced` | done | §0.1.3, §8.1 | src/adapters/claude/version/matrix.ts | No enforced rule without entry; no entry without fixture |
| H1-07 | H1 | Gate: corpus completeness + enforcement comparison | done | §11.1, §11.2, §11.3 | tests/correctness-gate.test.ts, tests/fixtures/ | Missing fixture fails; enforcement compared |
| H1-08 | H1 | Coverage metric denominator = §3 fact list | done | §11.4, inv 13 | tests/fixtures/coverage-report.ts | Denominator fixed at §3; CI-only |
| H1-09 | H1 | Fixtures: invalid-agents, collision-same-dir, collision-nested, nested-project | done | §11.1, A2–A4, A7 | tests/fixtures/claude/ | M0 acceptance #4, #5 covered by goldens |
| H1-10 | H1 | Fixtures: settings-permissions, skill-allowed-tools, depth-limit, environment | done | §11.1, S1–S8, K6, K7, N1–N3, §3.11 | tests/fixtures/claude/ | `[ext]` areas have fixture evidence |
| H1-11 | H1 | Fixtures: instructions, add-dir, version-drift, managed-simulation (plugin-agents blocked → H1-23) | done | §11.1, I1, I2, F9, A6, A8, A9, K12, §7.8, §8.4 | tests/fixtures/claude/ | §11.1 corpus complete (20/20) |
| H1-12 | H1 | Restore `src/core/` platform independence | done | §12.2, inv 1 | src/core/, src/adapters/claude/ | No Claude identifiers in core; goldens unchanged |
| H1-13 | H1 | McpServer model completeness + probe addressing | done | §5, §7.9, §12.5 | src/adapters/claude/discovery/mcp.ts, types.ts | `name`, `definitionKind`, `configHash`; probe by name |
| H1-14 | H1 | CLI parity with §12.5 (`explain`, `warnings`) | done | §12.5, §7.5, §7.6 | src/cli/index.ts | Both commands present, read-only |
| H1-15 | H1 | MCP probe hardening | done | §9.4, §7.9, §12.3 | src/adapters/claude/probing/mcp-probe.ts | Isolated env, SIGKILL escalation, redacted argv |
| H1-16 | H1 | Warn that `.agent-manager/` must be gitignored on first write | done | §12.3, H1-01 decision | src/adapters/claude/generation/, src/application/ | First write to `.agent-manager/` warns if not ignored |
| H1-17 | H1 | Decide whether degraded mode downgrades `status` too | done | §8.3, §11.3, §6 | src/adapters/claude/version/matrix.ts, tests/fixtures/coverage-report.ts | Decision recorded and implemented |
| H1-18 | H1 | Gate discovery and simulate verdicts through the matrix | done | §8.2, inv 11, A3, A4, A10, F8, F9 | src/adapters/claude/discovery/, src/application/simulate.ts | Five inert matrix entries actually consulted |
| H1-19 | H1 | Version-gate the Agent/Task alias expansion | done | F11, §8.2 | src/adapters/claude/resolution/tools.ts | Alias-dependent verdicts unknown below 2.1.63 |
| H1-20 | H1 | Resolving an ambiguous or invalid agent must not be silent | done | A4, §5, inv 3, 4, 14 | src/adapters/claude/resolution/resolver.ts | ambiguous-collision warning emitted; contested fields unknown |
| H1-21 | H1 | Settings permissions never resolved — denied tool can read as available | done | §4.4 rule 7, S1–S8, §6, inv 4, 14 | src/adapters/claude/resolution/, discovery/settings.ts | deny applied last and overrides everything |
| H1-22 | H1 | Fixture runs must not read the developer's own `~/.claude/` | done | §11.2, inv 2 | tests/fixtures/run-golden.test.ts, correctness-gate.test.ts | Goldens resolve identically on any machine |
| H1-23 | H1 | Plugin agents are never discovered | done | A1, A6, A8, F9, M1 #6 | src/adapters/claude/discovery/agents.ts | Plugin agents discovered; plugin-agents fixture lands |
| H1-24 | H1 | CLI and API disagree on the default execution context | done | §4.3, §4.1, T6 | src/server/routes/agents.ts, src/cli/index.ts | One shared default + caption on every surface |
| H1-25 | H1 | Flaky SIGTERM→SIGKILL escalation test | done | §9.4, §11.3 | tests/adapters/claude/probing/mcp-probe.test.ts | Cause identified; 20 consecutive passes |
| H1-26 | H1 | Cross-scope shadowing (A1) is the last ungated collision rule | done | A1, §8.2, §6, inv 3 | src/adapters/claude/version/matrix.ts, discovery/agents.ts | A1 gated like A3/A4 |
| H1-27 | H1 | Security findings contradict F9 for plugin agents | done | F9, §7.6, inv 3, 12, 14 | src/adapters/claude/resolution/security-findings.ts | No finding whose premise F9 nullifies |
| H1-28 | H1 | `confidence: "fixture"` means three different things across entries | done | §8.1, §8.2, §11.4, §0.1.3 | src/adapters/claude/version/matrix.ts, tests/fixtures/coverage-report.ts | One stated rule, applied uniformly |
| H1-29 | H1 | F8 model substitution asserts an undocumented value | done | F8, §0.1.1, §7.8, inv 14 | src/application/simulate.ts | Substitute identity unknown unless established |

## V0 — v0.1 UX polish

| ID | Phase | Title | Status | Spec refs | Files | Acceptance |
|----|-------|-------|--------|-----------|-------|------------|
| V0-01 | V0 | UI project folder selection | done | §12.4 M0 | src/ui/, src/server/routes/project.ts | Browse + Rescan + headless fallback |
| V0-02 | V0 | Bad project path is indistinguishable from a server failure | done | §12.4 M0 | src/server/routes/project.ts, src/ui/App.tsx | 400 + actionable message for a bad path; 500 stays generic |
| V0-03 | V0 | Agent dropdown lost its status badge | done | §12.4 M0 | src/ui/components/AgentSelector.tsx, src/ui/styles.css | Status visible again, valid `<option>` markup, tested |
| V0-04 | V0 | Custom select + dropdown styling | done | — | CapsightSelect.tsx | Custom listbox; badges inside rows |

## MP — Multi-platform (Cursor + Codex)

Per-platform scan (`platform=claude|cursor|codex`). Facts: [CURSOR-FACTS.md](./CURSOR-FACTS.md), [CODEX-FACTS.md](./CODEX-FACTS.md).

Order: MP-01 → MP-03 → MP-04 → MP-C01..C15 → MP-X01..X15.

| ID | Phase | Title | Status | Spec refs | Files | Acceptance |
|----|-------|-------|--------|-----------|-------|------------|
| MP-01 | MP | Cursor platform spike | done | MP plan | docs/CURSOR-FACTS.md | Facts corpus documented |
| MP-02 | MP | Codex platform spike | done | MP plan | docs/CODEX-FACTS.md | Facts corpus documented |
| MP-03 | MP | Backlog + SPEC + adapter rules | done | §12.2 | docs/TASKS.md, .cursor/rules/ | MP phase in backlog |
| MP-04 | MP | Adapter registry + scan routing | done | §12.2 | src/adapters/registry.ts, src/application/ | platform param; Claude unchanged |
| MP-C01 | MP | Cursor version detection | done | CV1–CV3 | src/adapters/cursor/version/ | Version or unknown |
| MP-C02 | MP | Cursor scope walk | done | CW1–CW3 | src/adapters/cursor/discovery/ | `.cursor/` walk |
| MP-C03 | MP | Cursor agents discovery | done | CA1–CA4 | src/adapters/cursor/discovery/agents.ts | Agents listed |
| MP-C04 | MP | Cursor skills + rules | done | CS1–CR3 | src/adapters/cursor/discovery/ | Skills, rules, AGENTS.md |
| MP-C05 | MP | Cursor MCP discovery | done | CM1–CM4 | src/adapters/cursor/discovery/mcp.ts | Read-only MCP |
| MP-C06 | MP | Cursor settings layers | done | CSet1–CSet3 | src/adapters/cursor/discovery/settings.ts | Settings listed |
| MP-C07 | MP | Cursor snapshot assembly | done | — | src/adapters/cursor/discovery/snapshot.ts | ProjectSnapshot platform=cursor |
| MP-C08 | MP | Cursor model + parsing | done | — | src/adapters/cursor/model/, parsing/ | Adapter-only types |
| MP-C09 | MP | Cursor version matrix + facts | done | — | src/adapters/cursor/version/ | Matrix + facts.ts |
| MP-C10 | MP | Cursor resolver | done | — | src/adapters/cursor/resolution/ | EffectiveConfiguration |
| MP-C11 | MP | Cursor security findings | done | — | src/adapters/cursor/resolution/ | Warnings honest |
| MP-C12 | MP | API/CLI/UI platform selector | done | §12.4 | server/, cli/, ui/ | Scan with platform |
| MP-C13 | MP | Cursor graph builder | done | §7.10 | adapters/cursor/resolution/ | Uses core graph |
| MP-C14 | MP | Cursor golden fixture basic | done | §11.1 | tests/fixtures/cursor/basic/ | Golden passes |
| MP-C15 | MP | Cursor correctness gate | done | §11.3 | tests/fixtures/run-cursor-golden.test.ts | Cursor golden runner |
| MP-X01 | MP | Codex version detection | done | XV1–XV3 | src/adapters/codex/version/ | Version or unknown |
| MP-X02 | MP | Codex scope walk + trust | done | XR1–XT3 | src/adapters/codex/discovery/ | `.codex/` + trust |
| MP-X03 | MP | Codex instructions discovery | done | XI1–XI5 | src/adapters/codex/discovery/instructions.ts | AGENTS.md chain |
| MP-X04 | MP | Codex skills discovery | done | XS1–XS3 | src/adapters/codex/discovery/skills.ts | Skills listed |
| MP-X05 | MP | Codex MCP discovery | done | XM1–XM3 | src/adapters/codex/discovery/mcp.ts | TOML MCP read-only |
| MP-X06 | MP | Codex settings layers | done | XSet1–XSet4 | src/adapters/codex/discovery/settings.ts | TOML layers |
| MP-X07 | MP | Codex snapshot assembly | done | — | src/adapters/codex/discovery/snapshot.ts | platform=codex |
| MP-X08 | MP | Codex model + parsing | done | — | src/adapters/codex/model/, parsing/ | Adapter-only |
| MP-X09 | MP | Codex version matrix + facts | done | — | src/adapters/codex/version/ | Matrix + facts |
| MP-X10 | MP | Codex resolver | done | — | src/adapters/codex/resolution/ | EffectiveConfiguration |
| MP-X11 | MP | Codex security findings | done | — | src/adapters/codex/resolution/ | Warnings |
| MP-X12 | MP | Codex API/CLI/UI (shared MP-C12) | done | §12.4 | (with MP-C12) | Codex scan works |
| MP-X13 | MP | Codex graph builder | done | §7.10 | adapters/codex/resolution/ | Uses core graph |
| MP-X14 | MP | Codex golden fixture basic | done | §11.1 | tests/fixtures/codex/basic/ | Golden passes |
| MP-X15 | MP | Codex correctness gate | done | §11.3 | tests/fixtures/run-codex-golden.test.ts | Codex golden runner |

## D1 — Depth (evidence before surface)

Closes the gap §11.4 measures: 9 of 92 Claude facts fixture-verified, Cursor and Codex with no coverage denominator at all and every matrix entry `unknown`. **Runs before EC.**

A task here may legitimately end with a fact still `unknown` and a recorded reason — understating evidence is always permissible, overstating it makes §11.4 mean less than it says (H1-28).

Order: D1-00 → D1-01 → **D1-09** → D1-10 → D1-02 → D1-03 → D1-04 → D1-05 → D1-06 → D1-07 → D1-08.

D1-09 and D1-10 came out of the D1-00/D1-01 review. D1-09 runs early: the corpus is not portable across checkout paths, so CI cannot be trusted until it lands.

D1-00 was found while verifying D1-01: fixture scans walk past the fixture project into the Capsight repository and read its own `.claude/agents/`. D1-01's code is complete and waits on a green suite.

| ID | Phase | Title | Status | Spec refs | Files | Acceptance |
|----|-------|-------|--------|-----------|-------|------------|
| D1-00 | D1 | Fixture runs must not read Capsight's own `.claude/` | done | §11.2, inv 2, H1-22 | tests/fixtures/fixture-runtime.ts, run-*-golden.test.ts | Repo's own agents cannot change a golden |
| D1-01 | D1 | Per-platform coverage denominator | done | §11.4, §11.3 | tests/fixtures/coverage-report.ts, correctness-gate.test.ts | Three reports; no hardcoded Claude root |
| D1-09 | D1 | Golden order must not depend on the checkout path | done | §11.2, §11.3, H1-22 | resolver.ts, instructions.ts, golden-normalize.ts | Order identical across ≥3 checkout paths |
| D1-10 | D1 | Isolation and portability follow-ups (5 review findings) | done | §11.2, §11.3 | tests/fixtures/fixture-runtime.ts, global-setup.ts, .gitignore | Isolation asserted on all three platforms |
| D1-02 | D1 | Complete settings-permissions fixture (S8–S10) | done | §3.5, §11.1–11.4, H1-28 | tests/fixtures/claude/settings-permissions/, matrix.ts | Each fact fixture-backed or doc-only with a reason |
| D1-03 | D1 | S6/S7 rule-argument semantics — evaluate or refuse | done | §3.5 S6–S7, §2.3, §14 | resolution/settings-permissions.ts, matrix.ts | Written decision per fact; no permission engine |
| D1-04 | D1 | S11 additionalDirectories + enableAllProjectMcpServers | done | §3.5 S11, §4.4, §8.2 | discovery/settings.ts, resolution/, matrix.ts | Two entries; trust interaction founded or unknown |
| D1-05 | D1 | K8/K10/K11 skill overrides + command precedence | done | §3.6, M1 #9, §8.2 | resolution/skills.ts, discovery/, matrix.ts | No `[ext]` fact drives a confident answer without a fixture |
| D1-06 | D1 | Close remaining pendingFixture entries (A10, F9, K4, K5, R5, B2) | done | §3, §11.1–11.4, H1-28 | tests/fixtures/claude/*, matrix.ts | No `pendingFixture` left in the Claude matrix |
| D1-07 | D1 | Cursor matrix + fixture depth | done | CURSOR-FACTS, §8, §11 | adapters/cursor/, tests/fixtures/cursor/ | ≥3 founded entries, ≥2 new fixtures, CT1 stays unknown |
| D1-08 | D1 | Codex matrix + fixture depth | done | CODEX-FACTS, §8, §11 | adapters/codex/, tests/fixtures/codex/ | ≥3 founded entries, trust difference pinned |

## EC — Ecosystem visualization

Declared-layer visualization across all detected platforms (SPEC §7.4). Replaces the Overview tab. Compat facts: [COMPAT-FACTS.md](./COMPAT-FACTS.md). **Phase complete** on `feat/ec-ecosystem`.

Order: EC-01 → EC-02 → EC-03 → EC-04 → EC-05 → EC-06 → EC-07 → EC-08.

| ID | Phase | Title | Status | Spec refs | Files | Acceptance |
|----|-------|-------|--------|-----------|-------|------------|
| EC-01 | EC | Cross-platform compatibility facts corpus | done | §3, §6, §8.1–8.2, §2.4 | docs/COMPAT-FACTS.md, src/core/compat/ | Three-valued verdict; every non-unknown gated by a matrix entry |
| EC-02 | EC | Multi-platform detection + merged inventory | done | §7.1, §7.4, §5, §12.2 | src/application/detect-platforms.ts, ecosystem.ts, scan-store.ts | `AGENTS.md` alone detects Cursor + Codex; overlaps linked, not merged |
| EC-03 | EC | Ecosystem API + guarded content endpoint | done | §12.4, §7.1, inv 10 | src/server/routes/ecosystem.ts, src/application/resource-content.ts | Id-addressed reads only; markdown classes only; no secret in any response |
| EC-04 | EC | Ecosystem canvas replaces Overview | done | §7.4, §7.10, §2.3 | src/ui/components/EcosystemView.tsx, ecosystem-layout.ts, DashboardNav.tsx | Four blocks, `overlaps` edge only, read-only canvas, side rail keeps scan controls |
| EC-05 | EC | Platform filter + compat badges | done | §6, §8.2, §2.4, §14 | src/ui/components/PlatformFilter.tsx, CompatBadges.tsx | Three states; badge traceable to a fact; filter dims, never removes |
| EC-06 | EC | Resource detail panel + rendered markdown | done | §7.5, §12.4, inv 10 | src/ui/components/ResourceDetailPanel.tsx, MarkdownBody.tsx | Sanitized render; MCP/settings show redacted model, no body |
| EC-07 | EC | Ecosystem health readout | done | §11.4, §6, §2.4 | src/application/ecosystem-health.ts, src/ui/components/EcosystemHealth.tsx | Counts and conditions, no score; every count filters the canvas |
| EC-08 | EC | Mixed-project golden fixture | done | §11.1–11.3, inv 2 | tests/fixtures/ecosystem/mixed/, run-ecosystem-golden.test.ts | Hermetic; pins unknowns as well as confident verdicts |
| D1-11 | D1 | Residual locale-sensitive sorts outside simulate.ts | done | §11.2 | managed-overlay.ts:281,335, plan.ts, generation/* | Sorts locale-independent; not golden-observable today |
| D1-12 | D1 | `PowerShell(...)` rules cite `settings.bashPrefixRules`, whose fact S6 names only `Bash` | done | S6, §8.2 | settings-permissions.ts:153-156 | Attribution names a fact covering the tool, or says it does not |
| D1-13 | D1 | `documentation-only` tier does not distinguish `[doc]` from `[ext]`/`[spike]` | done | §11.4, §8.1 | tests/fixtures/coverage-report.ts | Tier reflects the cited fact's own confidence, or is renamed |
| D1-14 | D1 | A `skills:` entry resolving to a command file reports `preloaded` on K1's authority | done | §3.6 K1, §8.2 | resolution/skills.ts, discovery/types.ts | Command-backed preload resolves `unknown`, not `preloaded` |
| D1-15 | D1 | No golden channel for snapshot-level warnings; A10's refusal overstates its obstacle | done | §11.2, §7.7 | golden-normalize.ts, matrix.ts | Channel exists, or A10's reason says "under the current golden shape" |
| D1-16 | D1 | `agent-hooks` normalizes to `instruction:<path>`, colliding with an instruction source | done | §11.2 | golden-normalize.ts:298-303, resolver.ts:505 | Two capabilities on one agent file cannot collapse to one id |

## V1 — UI Surface

Wiring existing API into the browser. **Scope OUT for the whole phase:** new resolver/discovery/matrix logic, observed layer (§9), permission engine (§2.3), writes to `.claude/**` beyond the existing M3 apply path, persistent desired state, drag-and-drop graph editing.

V1-01…V1-03 are compliance defects, not features: the browser today states restrictions without the caveat §2.4 makes mandatory, omits the declared/effective pairs §7.4 calls обязательные, and shows status without enforcement (invariant 3). They go first.

Order: V1-01 → V1-02 → V1-03 → V1-04 → V1-05 → V1-06 → V1-07.

| ID | Phase | Title | Status | Spec refs | Files | Acceptance |
|----|-------|-------|--------|-----------|-------|------------|
| V1-01 | V1 | Warnings surface — security findings visible | done | §2.4, §7.6, §7.7, inv 12 | src/ui/components/WarningsPanel.tsx, api.ts, EcosystemHealth.tsx | Browser shows no fewer warnings than `agent-manager warnings`; Bash guardrail caveat on screen; health counts drill down to messages |
| V1-02 | V1 | Declared vs effective pairs | done | §7.4, P1, P2, F8, F9, T3 | src/ui/components/DeclaredEffective.tsx, App.tsx | All four obligatory cases render both values with the reason; `fork` states that agent config does not apply |
| V1-03 | V1 | Capability list depth — kind + enforcement | done | inv 3, §6, §7.3 | src/ui/components/EffectiveCapabilities.tsx | Every row carries enforcement; `unknown` is visually distinct from `enforced`; filter or grouping by kind |
| V1-04 | V1 | Agent declared configuration block | done | §7.1, §5, M0 goal | src/ui/components/AgentList.tsx | Frontmatter as-is: tools, model, permissionMode, skills; existing invalid/ambiguous states preserved |
| V1-05 | V1 | Graph → Why bridge | done | §7.5, §7.10 | src/ui/components/GraphView.tsx, App.tsx | Node click selects the capability and opens Why; no new fetch path |
| V1-06 | V1 | Ecosystem → effective bridge | done | §7.4, §4.1 | src/ui/components/EcosystemView.tsx, App.tsx | Declared resource opens its effective resolution; platform/agent switch is explicit, never silent |
| V1-07 | V1 | Plan preview (read-only) + editor deferral | done | §10 M3 #2, §14, §12.4 M3 | src/ui/api.ts, src/ui/components/PlanPreview.tsx, docs/TASKS.md | `POST /api/plan` diff rendered read-only; no apply button; apply/rollback/history/probe deferrals recorded with reasons |

### Recorded deferrals (V1-07 writes these here)

| Surface | Endpoint | Reason |
|---|---|---|
| Apply + confirm | `POST /api/apply` | §14 ranks editing 7th of 8; CLI `apply` covers it. Revisit after D2 |
| Rollback + history | `POST /api/rollback/:id`, `GET /api/history` | Same; destructive flows earn a UI only alongside apply |
| MCP probe | `POST /api/mcp/:id/probe` | §7.9 confirmation flow + isolated process; developer-tone, CLI-appropriate |
| Managed simulation model pairs (F8) | `POST /api/simulate/managed` | F8 applies only with `availableModels` in managed bundle; regular effective API has no F8 delta. Full F8 surface in **P1-03** |

## D2 — Evidence depth

Works the 87 facts that reach no matrix entry (ROADMAP coverage baseline). Each ends as an entry or as a written `noFixturePossible` refusal. **No fourth platform.**

Order: D2-01 → D2-02 → D2-03 → D2-04 → D2-05 → D2-06.

| ID | Phase | Title | Status | Spec refs | Files | Acceptance |
|----|-------|-------|--------|-----------|-------|------------|
| D2-01 | D2 | Triage all unreferenced facts into a ledger | done | §3, §8.1, §11.4 | docs/EVIDENCE-LEDGER.md | Every one of the 87 gets a disposition: entry owed, refusal, or out of scope with reason |
| D2-02 | D2 | Claude: entries for the highest-value unreferenced facts | done | §3, §8.2, §11.1 | claude/version/matrix.ts, tests/fixtures/claude/ | Each new entry either fixture-backed or `noFixturePossible`; no entry claims a fixture it lacks |
| D2-03 | D2 | Cursor: raise fixture-verified past 3 | done | CURSOR-FACTS, §8, §11 | adapters/cursor/, tests/fixtures/cursor/ | New verified facts are the operative cause of a confident golden, per H1-28 |
| D2-04 | D2 | Codex: raise fixture-verified past 2 | done | CODEX-FACTS, §8, §11 | adapters/codex/, tests/fixtures/codex/ | Same criterion; trust difference stays pinned |
| D2-05 | D2 | **UI:** evidence line in the Why panel | done | §8.1, §7.5, inv 3, inv 13 | src/ui/components/WhyPanel.tsx | Each claim shows its fact confidence tier and matrix ref; doc-only reads visibly weaker than fixture-backed; no suite metric shown (inv 13) |
| D2-06 | D2 | Coverage gate: unreferenced count cannot rise | done | §11.4, §11.3 | tests/correctness-gate.test.ts | A new fact without a disposition fails the gate |

## P1 — Policy surface

Managed simulation (§7.8) gets the screen its named audience needs. **No new simulation logic** — `src/application/simulate.ts` already returns the delta.

Order: P1-01 → P1-02 → P1-03 → P1-04.

| ID | Phase | Title | Status | Spec refs | Files | Acceptance |
|----|-------|-------|--------|-----------|-------|------------|
| P1-01 | P1 | Simulation API client + bundle selection | done | §7.8, §12.4 M2 | src/ui/api.ts, src/server/routes/simulate.ts | Candidate bundle chosen through the existing browse path; read-only end to end |
| P1-02 | P1 | **UI:** simulation delta view | done | §7.8, §7.4 | src/ui/components/SimulationView.tsx, DashboardNav.tsx | Shadowed agents, denied tools, ignored fields, substituted models — each traceable to its cause |
| P1-03 | P1 | F8 substitute-model honesty in the delta | done | F8, §2.4, H1-29 | resolution/, SimulationView.tsx | The identity of a substitute model is `unknown` unless founded; never asserted |
| P1-04 | P1 | Managed-simulation golden fixture extension | done | §11.1–11.3 | tests/fixtures/claude/managed-simulation/ | Delta pinned in a golden, unknowns included |

## G1 — Version drift guard

§8.4 divergence becomes detectable instead of assumed away. Protects every confident answer the product gives once the platform moves past 2.1.x.

Order: G1-01 → G1-02 → G1-03.

| ID | Phase | Title | Status | Spec refs | Files | Acceptance |
|----|-------|-------|--------|-----------|-------|------------|
| G1-01 | G1 | Version applicability per matrix entry | done | §8.1, §8.2, §8.4 | */version/matrix.ts, resolve-enforcement | A detected version outside a rule's range downgrades that rule, not the whole scan |
| G1-02 | G1 | **UI:** drift banner + affected answers | done | §8.4, §2.4, inv 11 | src/ui/components/DriftBanner.tsx | User sees which answers the version gap touches; no blanket "unsupported" |
| G1-03 | G1 | Drift fixture: version above the matrix | done | §11.1–11.3, §8.4 | tests/fixtures/claude/version-drift/ | Golden pins the downgrade, not a confident answer |

## F0 — Review follow-ups

Post-4420172 review: UI must not match resolver output by message substring; warning enforcement visible; CLI/API warnings DRY.

Order: F0-01 → F0-02 → F0-03 → F0-04 → F0-05.

| ID | Phase | Title | Status | Spec refs | Files | Acceptance |
|----|-------|-------|--------|-----------|-------|------------|
| F0-01 | F0 | WarningItem renders enforcement | done | inv 3, §7.6 | WarningsPanel.tsx, styles.css | Each warning row shows enforcement; unknown visually distinct |
| F0-02 | F0 | Fork + drift: match by type/matrixRef, not prose | done | §7.4, T3, §8.4 | DeclaredEffective.tsx, DriftBanner.tsx | Fork notice uses context-filter + matrixRef T3; drift warnings match category version or matrixRef, not "Version matrix" substring |
| F0-03 | F0 | Warning↔capability link without UI heuristics | done | inv 3, §7.6 | resolver or WarningsPanel | Resolver sets capabilityIds on Warning OR capability badge removed; no endsWith/includes matching |
| F0-04 | F0 | SimulationView F8 display single source | done | F8, H1-29, §2.4 | SimulationView.tsx | No dead branch; substitute identity reads from entry.effective only |
| F0-05 | F0 | Shared collectAgentWarnings application helper | done | §12.5, §7.6, V1 gate | application/, cli/, routes/agents.ts | CLI and GET /api/warnings call one function; parity test |

## G1-04 — Drift demonstration (follow-up)

Order: G1-04 (after F0).

| ID | Phase | Title | Status | Spec refs | Files | Acceptance |
|----|-------|-------|--------|-----------|-------|------------|
| G1-04 | G1 | maxVersion on a confident rule + fixture proves downgrade | done | §8.4, §11.1 | matrix.ts, version-drift or new fixture | At fixture version rule is supported/enforced; above max → scoped unknown; neighbor stays confident |

## D3 — Evidence wave 2

Target: close Claude `entry-owed` priority-2 facts per EVIDENCE-LEDGER; unverified below 45. Gate D2-06 already fail-closed.

Order: D3-01 → D3-02 → D3-03 → D3-04 → D3-05.

| ID | Phase | Title | Status | Spec refs | Files | Acceptance |
|----|-------|-------|--------|-----------|-------|------------|
| D3-01 | D3 | Claude env-driven facts — matrix entries | done | §3.11, §11.4 | matrix.ts, environment fixture | E1,E2,E6,E8,B5,B6,N3,N4 (+ overlaps) referenced; unverified drops |
| D3-02 | D3 | Claude trust facts — matrix entries | done | §3.7, §11.4 | matrix.ts, trust/add-dir fixtures | R2, R6 referenced or honestly refused |
| D3-03 | D3 | Claude discovery/builtins — matrix entries | done | §3.3, §3.9, §11.4 | matrix.ts, discovery fixtures | T5, B1, B4 referenced or honestly refused |
| D3-04 | D3 | Claude skills/instructions/remaining | done | §3.6, §3.8, §3.10, §11.4 | matrix.ts, fixtures | K7, K9, I4, N1, P3, M4, M5 closed or refused |
| D3-05 | D3 | D3 gate — unverified below 45 | done | §11.4, D2-06 | EVIDENCE-LEDGER, coverage-report | Total unverified < 45; ledger matches buildCoverageReport |

## SS — Settings semantics (S6/S7/S11)

H1 outcome items that still resolve `unknown`: S6 prefix matching, S7 path globs, S11 relative additionalDirectories.

Order: SS-01 → SS-02 → SS-03.

| ID | Phase | Title | Status | Spec refs | Files | Acceptance |
|----|-------|-------|--------|-----------|-------|------------|
| SS-01 | SS | S6 Bash(cmd:*) prefix rule shape | done | §3.5 S6, §2.3 | settings-permissions.ts, matrix.ts, fixture | S6 pins non-unknown rule shape; fixture + deletion test |
| SS-02 | SS | S7 Read/Edit path glob anchoring | done | §3.5 S7, §2.3 | settings-permissions.ts, matrix.ts, fixture | S7 pins / vs // anchoring; fixture + deletion test |
| SS-03 | SS | S11 additionalDirectories relative paths | done | §3.5 S11 | settings-permissions.ts, matrix.ts, fixture | Relative entries honestly unknown; absolute pinned |

## D4 — Evidence depth (multi-platform)

Target: close all Cursor/Codex `entry-owed` facts per [EVIDENCE-LEDGER.md](./EVIDENCE-LEDGER.md); unverified ≤ 18 (terminal refusals only). Gates D2-06 + D3-05 unchanged.

Order: D4-01 → D4-02 → D4-03 → D4-04 → D4-05 → D4-06.

| ID | Phase | Title | Status | Spec refs | Files | Acceptance |
|----|-------|-------|--------|-----------|-------|------------|
| D4-01 | D4 | Cursor discovery/walk — matrix entries | done | CURSOR-FACTS, §11.4 | cursor/matrix.ts, fixtures | CW1,CW2,CW3,CA1,CS1 referenced or refused |
| D4-02 | D4 | Cursor rules/settings — matrix entries | done | CURSOR-FACTS, §11.4 | cursor/matrix.ts, fixtures | CR2,CR3,CSet3 referenced or refused |
| D4-03 | D4 | Codex version/walk — matrix entries | done | CODEX-FACTS, §11.4 | codex/matrix.ts, fixtures | XV1,XV2,XV3,XR1,XR2 referenced or refused |
| D4-04 | D4 | Codex instructions/trust — matrix entries | done | CODEX-FACTS, §11.4 | codex/matrix.ts, fixtures | XI3,XI4,XA1,XT3 referenced or refused |
| D4-05 | D4 | Codex settings/architecture — matrix entries | done | CODEX-FACTS, §11.4 | codex/matrix.ts, fixtures | XA3,XSet1 referenced or refused |
| D4-06 | D4 | D4 gate — zero entry-owed, unverified ≤ 18 | done | §11.4, D2-06 | EVIDENCE-LEDGER, coverage-report | entry-owed=0; ledger matches report |

## SS-deep — Settings argument depth

SS-01…03 pinned S6/S7/S11 *shape*. SS-deep evaluates whether prefix/glob *matching* is documentable without §2.3 permission engine.

Order: SS-04 → SS-05.

| ID | Phase | Title | Status | Spec refs | Files | Acceptance |
|----|-------|-------|--------|-----------|-------|------------|
| SS-04 | SS-deep | S6 — command prefix matching depth | done | §3.5 S6, §2.3 | settings-permissions.ts, matrix.ts, fixture | Matching half refused in writing; shape pins unchanged |
| SS-05 | SS-deep | S7 — path glob matching depth | done | §3.5 S7, §2.3 | settings-permissions.ts, matrix.ts, fixture | Matching half refused; anchoring pins unchanged |

## B1 — Builtin discovery channel

Unblocks B1/B4 matrix promotion: discovery currently emits file-backed agents only.

Order: B1-01.

| ID | Phase | Title | Status | Spec refs | Files | Acceptance |
|----|-------|-------|--------|-----------|-------|------------|
| B1-01 | B1 | Synthetic builtin inventory in discovery | done | §3.9 B1, B4, §11.1 | discovery/agents.ts, matrix.ts, fixtures | Six builtins listed; B4 override pin; B1 fixture-verified |

## G1-MP — Drift on Cursor/Codex

Mirror G1-04: `maxVersion` on one confident fixture-backed rule per platform; golden pins scoped downgrade above max.

Order: G1-MP-01 → G1-MP-02.

| ID | Phase | Title | Status | Spec refs | Files | Acceptance |
|----|-------|-------|--------|-----------|-------|------------|
| G1-MP-01 | G1-MP | Cursor maxVersion drift demo | in_progress | §8.4, §11.1 | cursor/matrix.ts, fixtures | Above max → scoped unknown; neighbor stays confident |
| G1-MP-02 | G1-MP | Codex maxVersion drift demo | todo | §8.4, §11.1 | codex/matrix.ts, fixtures | Same criterion as G1-MP-01 |

## Deferred backlog

| ID | Phase | Title | Status | Notes |
|----|-------|-------|--------|-------|
| §9 | S0 | Observed runtime layer | deferred | Revisit S0-DECISION when APIs mature |
