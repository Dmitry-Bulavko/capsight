# Capsight Roadmap

Contract: [SPEC.md](./SPEC.md) · Backlog: [TASKS.md](./TASKS.md) · Workflow: [DEVELOPMENT.md](./DEVELOPMENT.md)

## Current focus

**D1-00 and D1-01 done.** All three platforms now carry a §11.4 coverage report, and fixture runs are isolated from Capsight's own repository. **Scaffolding done — D1-00, D1-01, D1-09 and D1-10 are closed.** The corpus is isolated from this repository, portable across checkout paths, and its isolation guard is falsifiable on all three platforms. **D1-05 done; D1-06 is next.** Claude coverage reads **92 / 0 / 9 / 36 / 47** — `unverified` has fallen from 52 to 47 across the phase. The `pendingFixture` backlog stands at 6. Read the caveat on what `documentation-only` actually means before quoting that number.

Previous: **EC phase written** — ecosystem visualization handoffs EC-01…EC-08, now blocked on D1.

Previous: **V0-04 done** — custom `CapsightSelect` listbox with in-row status badges. Native MDN `<select>` abandoned (see `docs/tasks/V0-04-select-styling.md`).

## Phase status

| Phase | Status | Gate |
|-------|--------|------|
| I0 — Process setup | `done` | All I0 tasks done |
| S0 — Runtime observation spike | `done` | [S0-DECISION.md](./S0-DECISION.md) |
| M0 — Discovery Viewer | `done` | SPEC §10 Acceptance M0 |
| M1 — Resolver + Explainability | `done` | M1-15 correctness gate |
| M2 — Probe, Graph, Simulation | `done` | M2-06 complete |
| M3 — Editor (v0.2) | `done` | M3-03 complete |
| H1 — Correctness hardening | `done` | H1-29 closed; corpus 20/20 |
| V0 — v0.1 UX polish | `done` | V0-01..V0-04 complete |
| MP — Multi-platform | `done` | MP-C15 + MP-X15 golden gates |
| D1 — Depth (evidence) | `in_progress` | No `pendingFixture` left (promoted or declared unpromotable); three coverage reports |
| EC — Ecosystem visualization | `blocked` | Waits on D1-07 + D1-08 |

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
| cursor | 26 | 0 | 0 | 4 | 22 | 1 |
| codex | 25 | 0 | 0 | 4 | 21 | 1 |

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

`entryFactCoverageTier` never consults `factConfidence`, so **any** cited fact lands in `documentation-only` regardless of whether §3 marks it `[doc]`, `[ext]` or `[spike]`. K10 is `[ext]` — an unconfirmed third-party claim — and now counts there purely because an entry that states no rule names it.

This is the metric's designed behaviour rather than a regression (K12 already sat there the same way), but the tier's name overstates what an `[ext]` citation establishes, and the effect compounds every time an entry cites a fact. Treat `documentation-only` as "some entry refers to this", not as "this is documented". D1-13 owns the fix or the rename.

**This lowers the phase's ceiling.** The earlier estimate of 9 → roughly 20 fixture-verified assumed the twelve pending entries were mostly convertible. On the first sample, three of four were not. A more honest expectation is that D1 ends with a materially smaller `pendingFixture` list, a handful of promotions, and several facts formally recorded as unprovable by fixture — with the §11.4 count moving far less than the amount of work suggests.

## EC scope note

**Sequenced after D1.** Compatibility badges are claims about three platforms; two of those adapters found nothing until D1-07 and D1-08 land, so building EC first would produce badges resting on an empty matrix.

The Graph tab visualizes the **effective** layer: one platform, one execution context, edges recomputed per context. The Ecosystem screen visualizes the **declared** layer: every detected platform at once, no context, no resolver. SPEC §7.4 names both halves; only the effective one had a surface until now.

Two rules constrain the phase:

- A compatibility badge is a claim about platform behaviour and is gated like any other (§8.2). `unknown` is the default verdict and is expected to dominate at v1.
- Platform detection is evidence-based and honours shared artifacts: `AGENTS.md` is consumed by both Cursor and Codex, so its presence alone enables both. Undetected platforms remain selectable in the filter — "what would this project lose under platform X" is the question the assessment use case asks.

The canvas stays read-only: no dragging, no connecting, no persisted positions (§2.3).

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
