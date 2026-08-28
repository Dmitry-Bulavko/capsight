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
| H1-21 | H1 | Settings permissions never resolved — denied tool can read as available | in_progress | §4.4 rule 7, S1–S8, §6, inv 4, 14 | src/adapters/claude/resolution/, discovery/settings.ts | deny applied last and overrides everything |
| H1-22 | H1 | Fixture runs must not read the developer's own `~/.claude/` | todo | §11.2, inv 2 | tests/fixtures/run-golden.test.ts, correctness-gate.test.ts | Goldens resolve identically on any machine |
| H1-23 | H1 | Plugin agents are never discovered | todo | A1, A6, A8, F9, M1 #6 | src/adapters/claude/discovery/agents.ts | Plugin agents discovered; plugin-agents fixture lands |
| H1-24 | H1 | CLI and API disagree on the default execution context | todo | §4.3, §4.1, T6 | src/server/routes/agents.ts, src/cli/index.ts | One shared default + caption on every surface |
| H1-25 | H1 | Flaky SIGTERM→SIGKILL escalation test | todo | §9.4, §11.3 | tests/adapters/claude/probing/mcp-probe.test.ts | Cause identified; 20 consecutive passes |
| H1-26 | H1 | Cross-scope shadowing (A1) is the last ungated collision rule | todo | A1, §8.2, §6, inv 3 | src/adapters/claude/version/matrix.ts, discovery/agents.ts | A1 gated like A3/A4 |
