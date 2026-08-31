# Capsight Roadmap

Contract: [SPEC.md](./SPEC.md) · Backlog: [TASKS.md](./TASKS.md) · Workflow: [DEVELOPMENT.md](./DEVELOPMENT.md)

## Current focus

**D5 — Evidence depth wave 5** is active. Next: D5-01 promotion triage.

Previous: **G1-MP complete** — three-platform drift demos. Baseline **41/145 fixture-verified (28%)**, unverified **18** terminal.

## Phase order (active backlog)

```
D5 (fixture promotion) → §9
```

Waves 1–4 closed `entry-owed` and unverified floor. Wave 5 promotes matrix-referenced facts that already have fixtures but lack `verifiedFacts` deletion tests.

Completed chain: `… → D4 → SS-deep → B1 → G1-MP`.

## Phase status

| Phase | Status | Gate |
|-------|--------|------|
| I0 — Process setup | `done` | All I0 tasks done |
| S0 — Runtime observation spike | `done` | [S0-DECISION.md](./S0-DECISION.md) |
| M0 — Discovery Viewer | `done` | SPEC §10 Acceptance M0 |
| M1 — Resolver + Explainability | `done` — CLI/API | M1-15 correctness gate · browser surface in V1 |
| M2 — Probe, Graph, Simulation | `done` — CLI/API | M2-06 complete · probe/simulate stay CLI-only until P1 |
| M3 — Editor (v0.2) | `done` — CLI/API | M3-03 complete · apply/rollback stay CLI-only (V1-07) |
| H1 — Correctness hardening | `done` | H1-29 closed; corpus 20/20 |
| V0 — v0.1 UX polish | `done` | V0-01..V0-04 complete |
| MP — Multi-platform | `done` | MP-C15 + MP-X15 golden gates |
| D1 — Depth (evidence) | `done` | D1-00…D1-16 closed; three-platform coverage reports honest |
| EC — Ecosystem visualization | `done` | EC-01…EC-08 complete; ecosystem golden fixture |
| V1 — UI Surface | `done` | §2.4, §7.4 and invariant 3 observable in the browser |
| D2 — Evidence depth | `done` | Every fact either matrix-referenced or refused in writing |
| P1 — Policy surface | `done` | Managed simulation usable without the terminal |
| G1 — Version drift guard | `done` | §8.4 divergence detectable, not assumed away |
| F0 — Review follow-ups | `done` | No UI prose-matching; warning enforcement visible; CLI/API warnings shared |
| G1-04 — Drift demonstration | `done` | Confident rule downgrades on version exceed, neighbors stay confident |
| D3 — Evidence wave 2 | `done` | Unverified below 45; Claude entry-owed closed |
| SS — Settings semantics | `done` | S6/S7 shape pinned; S11 relative paths honest unknown |
| D4 — Evidence depth (multi-platform) | `done` | Zero `entry-owed`; unverified ≤ 18 |
| SS-deep — Settings argument depth | `done` | S6/S7 matching refused; shape pins from SS unchanged |
| B1 — Builtin discovery channel | `done` | Six builtins in discovery; B1 fixture-verified; B4 override pinned |
| G1-MP — Drift on Cursor/Codex | `done` | maxVersion on confident rule per platform |
| D5 | Evidence depth wave 5 | `todo` | doc-only → fixture-verified where H1-28 allows; floor gate |
| §9 — Observed layer | `deferred` | Revisit [S0-DECISION.md](./S0-DECISION.md) when platform APIs mature |

## Surface rule

**Every phase ships something a person can see in the browser.** Not a screenshot at the end — a task inside the phase whose acceptance is visual.

The rule exists because the first six phases broke it. M1, M2 and M3 are marked `done` on acceptance criteria written as *«показаны раздельно»*, *«показывается пользователю»*, *«после apply показывается …»* — and all three were closed against the CLI and the API. That is how the project arrived at a resolver of real depth behind a dashboard that renders four of eleven route groups and not one warning. A phase that produces only engine is not finished; it is deferred, and the deferral has to be written into TASKS with a reason.

Practically, for each phase below: at least one task is a UI task, it is not scheduled last, and the phase gate names what becomes visible.

## Coverage baseline (measured post-B1, `buildCoverageReport`)

Recomputed from `buildCoverageReport` + [EVIDENCE-LEDGER.md](./EVIDENCE-LEDGER.md):

| platform | facts | unverified | entry-owed | fixture-verified | documentation-only | externally-cited |
|---|---|---|---|---|---|---|
| claude | 92 | 10 | 0 | 18 | 52 | 12 |
| cursor | 27 | 7 | 0 | 10 | 5 | 2 |
| codex | 26 | 1 | 0 | 13 | 9 | 1 |
| **total** | **145** | **18** | **0** | **41 (28%)** | **66** | **15** |

All remaining unverified facts carry terminal ledger disposition (`noFixturePossible` or `out-of-scope`). D2-06, D3-05, and D4-06 gates are fail-closed — counts must not rise without an explicit gate change.

**Evidence honest ceiling:** 18 unverified cannot shrink without §9 runtime layer or new platform facts. Fixture-verified ratio grows only where H1-28 deletion tests exist — not by lowering the bar.

## Coverage baseline (measured post-D4, `buildCoverageReport`) — historical

## D4 scope note — Evidence wave 3 (multi-platform)

D2 triaged 87 unreferenced facts; D3 closed Claude priority-2 clusters (35→10 unreferenced). D4 closed the deferred Cursor and Codex `entry-owed` rows via matrix entries or terminal refusals.

**D4 outcome.** Total unverified across the three registries dropped from **37 to 18**. Claude held at 10; Cursor fell 15→7; Codex fell 12→1. All 19 `entry-owed` facts on Cursor and Codex are closed. Every remaining unverified fact has a terminal ledger disposition (D2-06 gate unchanged). D4-06 adds a fail-closed ceiling test so `entry-owed` cannot reappear and unverified cannot rise above 18 without an explicit gate change.

**Gate:** `entry-owed` count = 0 platform-wide; total unverified ≤ 18; ledger measured counts match `buildCoverageReport` per platform.

**Honest ceiling:** Facts that cannot be fixture-promoted (home-path layers, spike-only probes, unknown registry confidence) stay unreferenced with terminal disposition — that is success, not failure.

## D5 scope note — Evidence depth wave 5 (fixture promotion)

Waves 1–4 closed structural gaps (`entry-owed=0`, unverified **18** terminal). Wave 5 targets the **maturity gap**: facts matrix-referenced at `documentation-only` that already have fixtures and resolver wiring but no H1-28 `verifiedFacts` promotion.

**Baseline (post-B1/G1-MP):**

| platform | fixture-verified | documentation-only | unverified |
|---|---|---|---|
| claude | 18 / 92 (20%) | 52 | 10 |
| cursor | 10 / 27 (37%) | 5 | 7 |
| codex | 13 / 26 (50%) | 9 | 1 |
| **total** | **41 / 145 (28%)** | **66** | **18** |

**Primary ROI:** Claude — 52 doc-only facts; many entries already carry `confidence: "fixture"` with `verifiedFacts: []` (entry-level pin without §11.4 fact promotion). Cursor/Codex doc-only rows are mostly terminal `noFixturePossible` (5 + 9); opportunistic only.

**Promotion clusters (wave 5 tasks):**

| Cluster | Facts (candidates) | Existing fixtures | Risk |
|---|---|---|---|
| Context / tools | T1, T2, T3, T5, F11 | tools-filters, background, fork | Medium — filter semantics |
| Permissions / trust | P1, P5, R1, R2, R5, R6 | permission-inheritance, trust-inline-mcp, add-dir, nested-project | Medium — partial pins already |
| Skills / instructions / builtins | K1, K7, K11, I1, B2, B4 | skills-preload, skill-allowed-tools, instructions, builtin-agents | Low–medium — B4 partial today |
| Environment | E1–E9, B5, B6, N3, N4 | environment, depth-limit | High — discovery.environment channel may pin keys only |
| Housekeeping | `agent.depthLimitDefault` pendingFixture, verifiedFacts audit | version-drift, depth-limit | Low — matrix consistency |

**Honest ceiling:** Facts already refused (`noFixturePossible`, §2.3 matching halves, §9 out-of-scope) are out of scope. Promotion that fails deletion test stays doc-only with reason recorded — not a task failure.

**Gate (D5-07):** D4-06 unchanged (`entry-owed=0`, unverified ≤ 18); total fixture-verified ≥ **50** (from 41) OR explicit gate revision in handoff with measured refusal count; promotion refusals recorded in ledger.

## D5 scope note (historical) — Evidence depth wave 4 (fixture + channels)

Wave 4 closed SS-deep (S6/S7 matching refusals) and B1 (builtin discovery channel). See phase status SS-deep + B1.

## Coverage baseline (measured 2026-08-30, `28a510b`) — historical

Recomputed from the project's own `buildCoverageReport` over the three fixed fact registries:

| platform | facts | fixture-verified | documentation-only | externally-cited | matrix-referenced unknown | unverified | fixtures |
|---|---|---|---|---|---|---|---|
| claude | 92 | 11 | 23 | 11 | 0 | 47 | 20 |
| cursor | 27 | 3 | 0 | 0 | 3 | 21 | 4 |
| codex | 26 | 2 | 4 | 0 | 1 | 19 | 4 |

Two corrections to the D1-era numbers recorded below: Claude moved 9 → 11 fixture-verified and 52 → 47 unverified over D1-04…D1-06, and the D1 scope note's structural claim — that Cursor and Codex *cannot* rise above `documentation-only` because their `FeatureCompatibility` carries no `verifiedFacts` field — was closed by D1-07 and D1-08. Both adapters have the field and both now have fixture-verified facts. The note is kept as written because it records what was true when the phase was planned.

**87 facts across the three platforms still reach no matrix entry at all.** That is the denominator D2 works against, and it is the single largest risk to the product's central claim.

## D1 scope note

Measured baseline at `334c227`, from the project's own `buildCoverageReport`:

```
SPEC §3 facts (Claude) : 92
runtime-observed       : 0
fixture-verified       : 9
documentation-only     : 31
unverified             : 52
```

Measured after D1-01, which gave the two newer adapters a denominator for the first time:

| platform | facts | runtime-observed | fixture-verified | documentation-only | unverified | fixtures |
|---|---|---|---|---|---|---|
| claude | 92 | 0 | 9 | 31 | 52 | 20 |
| cursor | 26 | 0 | 0 | 4 | 22 | 4 |
| codex | 25 | 0 | 0 | 4 | 21 | 4 |
| ecosystem | — | — | — | — | — | 1 |

Cursor and Codex sit at zero fixture-verified for a structural reason, not merely a thin corpus: their `FeatureCompatibility` interfaces carry no `verifiedFacts` field, and every matrix entry is `confidence: "doc"` with `status: "unknown"`, so `entryFactCoverageTier` cannot return anything above `documentation-only` however many fixtures are added. D1-07 and D1-08 have to add that field before their numbers can move at all.

The concrete target is the matrix's own `pendingFixture` field: twelve entries name the fixture that still owes them evidence, covering A10, F9, K4, K5, R5, S6, S7, S8, S9, S10 and B2. Emptying that field is what finishing D1 means on the Claude side. It is a ceiling, not a promise — some of those facts will end the phase still `unknown`, with the reason recorded, and that is a result rather than a shortfall (§14, H1-28).

**52 of the 92 Claude facts reach no matrix entry at all** — that is precisely why `unverified` is 52. An earlier draft of this section said "four", having checked only the four IDs it named; the real figure is the whole unreferenced set (`A2, A5, A6, A7, A8, F1, F5, F6, F7, F10, T4, T5, T6, P3, …`). D1-04 and D1-05 own four of them (S11, K8, K10, K11); the remaining 48 are not scoped by any task in this phase, and closing them is larger than D1.

So D1's honest ceiling is narrower than the gap: the phase converts the twelve `pendingFixture` debts and four named facts, and leaves the rest visible and counted.

## Corpus portability (closed by D1-09)

Instruction `capabilityId` was `sha256("instruction:" + absolute path)` and `sortCapabilities` ordered by that hash, so golden order was a function of the checkout location: the corpus reproduced at `/home/user/capsight` but reordered at `/home/runner/work/...`, the default GitHub Actions path. D1-09 sorts instruction capabilities on their project-relative path instead and drops the locale-sensitive comparator alongside it. Both re-recorded goldens were verified to be pure permutations, and the portability test replays four unrelated checkout shapes. `cursor/basic` was checked empirically and needed no change.

The corpus is portable; CI can run the suite from any path.

## What the scaffolding cost, and why

Four of the phase's tasks did not exist when it opened: D1-00, D1-09, D1-10 and the deferred D1-11 all came out of reviews rather than the plan. That is not scope creep — each is a corpus defect that would have let the remaining tasks found their conclusions on unstable ground:

- **D1-00** — fixture scans read this repository's own `.claude/agents/`, so a golden's verdict changed when Capsight gained an agent.
- **D1-09** — golden order derived from a hash of the absolute checkout path, so the corpus failed on GitHub Actions' default path.
- **D1-10** — the isolation guard was satisfied by a marker left behind by any killed run, so it passed without observing what it guarded (H1-07). One zero-byte stale file made all nine isolation assertions inert.

Two of the four were caught only because review is done by an agent other than the author. D1-10 in particular passed its own implementer's checks and its first review, and failed on the second when a reviewer reproduced the defect in the live working tree.

The evidence tasks (D1-02 … D1-08) are where the phase's value is; the scaffolding merely made them mean something.

## What D1-02 established, and what it recalibrates

The coverage numbers are **unchanged** — 92 / 0 / 9 / 31 / 52, before and after. That is correct, not a failure. `settings.webFetchRules` was promoted to `confidence: "fixture"` on a literal deletion test (removing the rule moves a golden from `blocked/enforced` to `unknown/unknown`), but its `verifiedFacts` is empty: the fixture pins one edge of S8, not S8 entire, so the *entry* gained confidence and the *fact* count did not. H1-28 works exactly as designed.

The real progress measure for this phase is the `pendingFixture` backlog, which went **12 → 8**:

| Entry | Outcome |
|---|---|
| `settings.webFetchRules` | promoted to `fixture` |
| `settings.denySubagents` | **unpromotable** — `ResolvedCapability["kind"]` has no subagent member, so a `deny: Agent(<name>)` has nothing in the capability set to lower |
| `settings.denySkills` | **unpromotable** — every value the rule can cause is `unknown`; a confident `denied` would be invented semantics |
| `settings.ruleScope` | **unpromotable** — `status` is `unknown` by construction, and H1-28 bars such an entry from ever reaching `fixture` |

Three of the first four turned out to be debts that can never be paid rather than debts not yet paid. `FeatureCompatibility` gained a third field, `noFixturePossible`, so that state is machine-checkable instead of living in prose: every entry now declares exactly one of `fixture` / `pendingFixture` / `noFixturePossible`, asserted over all 39 entries.

D1-03 continued the pattern and went further: it ended with **no production code at all**. S6 (`Bash(cmd:*)` prefix matching) and S7 (`Read`/`Edit` globs) were both refused as unprovable and moved to `noFixturePossible`.

The refusal turned on a distinction worth recording, because the opposite move was available and tempting. D1-02 promoted S8 by treating a WebFetch rule without the `domain:` prefix as granting nothing. The parallel move for S6 would treat a mid-pattern `:*` the same way. It was refused because the facts are not parallel in form: S8 says the prefix is *required*, so a rule lacking it is malformed; S6 says only that `:*` is not a wildcard away from the end, so such a rule is still valid and merely matches something narrower. Review confirmed this independently by comparing the neighbours — S3 ("invalid") and S4 ("ignored and allow nothing") do use the language that licenses a confident `blocked` verdict, and S6 pointedly does not.

Both entries also record *why* they are unprovable in a way a later reader can act on: not physical impossibility, but impossibility under a permanent scope choice — the evidence that would promote them is a verdict of the form "this command line would be approved", which is the permission engine §2.3 forbids this product to have.

D1-04 broke the pattern, and it is worth naming why it could. S6, S7, S9 and S10 all asked the product to state what a rule does to a *specific* invocation — a command line, a path, a subagent that has no capability kind. S11 asks only what two settings keys are and what they widen, which is discovery. So it produced code where the others produced refusals, and it moved the fact from having no consumer at all to being read by the resolver.

Both new entries are `confidence: "fixture"` with `verifiedFacts: []` — the D1-02 shape again, because each pins one clause of S11 rather than the fact entire. `fixture-verified` therefore stays at 9. The lesson is consistent across all three evidence tasks so far: **the §11.4 fact count is a far slower measure than the work behind it**, and entry-level confidence is where the progress actually shows.

D1-05 produced the phase's largest single movement — four facts (K8, K10, K11, K6) out of `unverified` — and its most useful correction. **The handoff's premise was wrong.** It assumed `.claude/commands/*.md` was not discovered and warned that adding a discovery path merely to state a rule would be scope creep. In fact `discoverCommands` already existed on `main` and the skills-first walk was already deciding name collisions — with no matrix entry, no gate and no fixture. That is an `[ext]` fact driving a confident discovery output, the M1 acceptance #9 violation this phase exists to close. Founding K11 added no discovery path; it attached the gate and the evidence to a mechanism that was already running blind.

K8 produced the disagreement the handoff asked for rather than a smoothed answer: the rule as implemented is **S2's, not K8's**. K8 speaks of a *global* deny; S2 says a deny at any level is not overridden. The fixture's deny is project-layer, so the rule rests on S2, the broader statement, rather than on reading K8's "global" more widely than it is written.

## Caveat on `documentation-only`

**Closed by D1-13.** Matrix-referenced facts without fixture evidence are split by registry confidence: `documentation-only` (`[doc]`), `externally-cited` (`[ext]`), `spike-cited` (`[spike]`), `matrix-referenced-unknown`. Do not treat `documentation-only` as "any matrix citation".

D1-06 closed the last six debts and produced the phase's only movement in `fixture-verified`, 9 → 11, by counting **F9 and K4 entire**. Review reproduced both deletion tests: without the plugin-field rule the golden does not merely differ, it becomes confident and wrong — the permission mode flips to `bypassPermissions` and all three warnings vanish.

It also corrected a false premise in the project's own history. H1-28 demoted `agent.pluginFieldLimits` on the stated grounds that no plugin agent in the corpus declared `hooks`, `mcpServers` or `permissionMode`. That was untrue of the corpus at the moment it was written — `security.md` had declared all three since H1-23, and the golden already carried all three warnings. **F9 sat at `doc` for a whole phase for a reason that never existed.** No fixture edit was needed to promote it; reading the corpus was enough. The H1-28 task record now carries the correction inline.

Final tally for the twelve `pendingFixture` debts: **four promoted, eight refused.** Two of the four count their fact entire.

**This lowers the phase's ceiling.** The earlier estimate of 9 → roughly 20 fixture-verified assumed the twelve pending entries were mostly convertible. On the first sample, three of four were not. A more honest expectation is that D1 ends with a materially smaller `pendingFixture` list, a handful of promotions, and several facts formally recorded as unprovable by fixture — with the §11.4 count moving far less than the amount of work suggests.

## EC scope note

**D1 gate cleared.** Compatibility badges are claims about three platforms; D1-07 and D1-08 gave Cursor and Codex honest matrix depth before EC begins.

The Graph tab visualizes the **effective** layer: one platform, one execution context, edges recomputed per context. The Ecosystem screen visualizes the **declared** layer: every detected platform at once, no context, no resolver. SPEC §7.4 names both halves; only the effective one had a surface until now.

Two rules constrain the phase:

- A compatibility badge is a claim about platform behaviour and is gated like any other (§8.2). `unknown` is the default verdict and is expected to dominate at v1.
- Platform detection is evidence-based and honours shared artifacts: `AGENTS.md` is consumed by both Cursor and Codex, so its presence alone enables both. Undetected platforms remain selectable in the filter — "what would this project lose under platform X" is the question the assessment use case asks.

The canvas stays read-only: no dragging, no connecting, no persisted positions (§2.3).

## Phase order after EC

```
V1 (surface)  →  D2 (evidence)  →  P1 (policy surface)  →  G1 (drift guard)
```

V1 is first because the product currently shows a *less* honest picture in the browser than in the terminal, and that is a correctness problem, not a backlog item. D2 is second because every later claim rests on the fact corpus. P1 before G1 because managed simulation is the one feature in the spec with a named paying audience (§7.8), and G1 is insurance whose value grows with the corpus D2 builds.

## V1 scope note — UI Surface

Wiring existing API into the interface. **No new resolver, discovery or matrix logic** — if a task needs one, it is out of scope and gets recorded instead.

The phase opens with three compliance tasks, not with the easiest ones:

- **§2.4 and invariant 12.** `security-findings.ts` already produces «Agent has Bash access. Tool-level restrictions are a guardrail, not a complete security boundary.» Nothing in `src/ui/` renders warnings, while `EffectiveCapabilities` renders a `denied` badge as bare fact. The browser therefore states a restriction without the caveat the spec makes mandatory. V1-01.
- **§7.4.** «Везде, где declared-значение может не действовать, показывать оба» — обязательно for `permissionMode`, `model` (F8), plugin fields (F9) and the whole configuration under `fork` (T3). `permissionMode` does not appear anywhere in `src/ui/`. V1-02.
- **Invariant 3.** Every assertion carries source, reason and enforcement. The Why panel honours this; the capability list shows status alone, so `unknown` enforcement is indistinguishable from `enforced` until clicked. V1-03.

Editing is deliberately *not* completed in this phase. §14 ranks editing seventh of eight priorities, so V1 ships a read-only plan preview (V1-07) and leaves apply, rollback and history in the CLI, recorded as an explicit deferral rather than an omission. MCP probe UI stays deferred for the same reason (§7.9 confirmation flow, developer-tone).

**Gate:** the browser shows no fewer warnings than `agent-manager warnings`; every §7.4-obligatory pair is on screen; every capability shows its enforcement without a click.

## D2 scope note — Evidence depth

D1 converted the twelve `pendingFixture` debts. It did not touch the 87 facts that reach no matrix entry, and said so. D2 works that denominator directly: each fact either gets an entry, or a written refusal saying why no fixture can promote it (`noFixturePossible`, the mechanism H1-28 built for exactly this).

The phase goes deeper on the platforms already supported. **It adds no fourth platform.** MP and EC widened the surface while Cursor and Codex sat at zero fixture-verified facts; that ordering will not be repeated.

Its UI task surfaces per-claim evidence in the Why panel — the cited fact's own confidence tier and matrix reference, so a doc-only claim is visibly weaker than a fixture-backed one. This is a property of the individual claim under §8.1, **not** the coverage report: invariant 13 forbids showing the test-suite metric as a property of the user's project, and §11.4 keeps that report CI-only.

**Gate:** no fact in any of the three registries is silently unreferenced; every remaining gap is a declaration.

## D3 scope note — Evidence wave 2

D2 triaged the 87-fact unreferenced denominator and closed priority-1 matrix entries on all three platforms. D3 closed Claude priority-2 clusters (environment, trust, discovery/builtins, skills/instructions/remaining) via honest matrix entries and fixture extensions.

**D3 outcome.** Total unverified across the three registries dropped from **87 to 37** (below the 45 gate). Claude unverified fell from 47 to 10; Cursor and Codex unchanged at 15 and 12. Every remaining unverified fact has a terminal ledger disposition (D2-06 gate unchanged). D3-05 adds a fail-closed ceiling test so the count cannot rise back above 45 without an explicit gate change.

**Gate:** `buildCoverageReport` total unverified < 45; ledger measured counts match the report per platform.

## P1 scope note — Policy surface

§7.8 names managed simulation the differentiator and names its user: a platform team rolling policy across dozens of repositories. It is fully implemented, fully read-only, and reachable only by typing `agent-manager simulate --managed ./candidate/`.

P1 gives it a screen: pick a candidate bundle, see which agents become shadowed, which tools become denied, which fields are ignored, which models are substituted under `availableModels` (F8). No new simulation logic — `src/application/simulate.ts` already returns the delta.

**Gate:** a platform team can answer "what does this policy do to this repository" without a terminal.

## G1 scope note — Version drift guard

Every confident answer the product gives is pinned to Claude Code 2.1.x. §8.4 defines what divergence means; nothing currently detects it. When the platform ships 2.2, the product does not degrade loudly — it keeps answering with the same confidence against a matrix that has quietly stopped applying.

G1 builds the mechanism: matrix entries carry version applicability, a detected version outside a rule's range downgrades that rule rather than the whole scan, and the user sees which of their answers are affected.

**Gate:** a version outside the matrix produces a visible, scoped downgrade — never a silent confident answer.

**G1 outcome (honest ceiling).** Version applicability is wired on all three platforms and the DriftBanner reads resolver downgrades. **G1-04** closed the follow-up: `agent.tools` (`status: "supported"`) carries `maxVersion: "2.1.499"`; version-drift at 2.1.500 downgrades tools-whitelist capabilities to unknown while `permission:default` and depth-limit rules on the same resolution stay enforced. Deletion test confirms Read returns to `available/enforced` when the bound is removed. No Cursor or Codex matrix entry declares `maxVersion` yet; drift there is covered by unit tests with a patched matrix only.

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

- The identity of an F8 substitute model, which the simulation still asserts (H1-29) — **closed in F0-04**.
- The observed layer (§9), excluded from v0.1 by the S0 decision.

**SS phase (done):** S6 `:*` position shape and S7 `/` vs `//` anchoring are fixture-pinned in `settings-permissions`; relative `additionalDirectories` stay `unknown` (§3.5 does not define resolution base).

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

Settings-permission precedence and skill overrides were revisited by D1-03 (S6/S7) and D1-05 (K8, K10, K11): each was either founded or refused in writing, and the refusals resolve `unknown` in the goldens rather than guessing. What is left of S1–S8 and K12 stays here, and D2 decides whether each becomes an entry or a recorded refusal.

Live runtime observation layer if platform APIs mature (revisit S0).
