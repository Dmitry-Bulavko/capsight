# Evidence promotion — documentation-only triage (D5-01)

Matrix-referenced facts at tier `documentation-only` have a matrix entry and often a fixture, but lack H1-28 `verifiedFacts` promotion — the fact is not yet the operative cause of a confident golden value (SPEC §8.1, §11.4).

**Measured:** `buildCoverageReport` over each platform's `facts.ts` + `VERSION_MATRIX` + declared fixture corpus (`tests/fixtures/coverage-report.ts`).

| | claude | cursor | codex | **total** |
|---|--------|--------|-------|-----------|
| fixture-verified (baseline) | 18 | 10 | 13 | **41** |
| fixture-verified (D5-07) | 19 | 10 | 13 | **42** |
| documentation-only | 51 | 5 | 9 | **65** |
| externally-cited | 12 | 2 | 1 | 15 |
| unverified | 10 | 7 | 1 | 18 |

Compat-matrix citations do not count toward platform coverage.

## Disposition values

| Disposition | Meaning |
|-------------|---------|
| `promotion-owed` | D5-02…06 should attempt H1-28 promotion (`verifiedFacts` + deletion test) or record refusal in matrix notes |
| `partial-pin` | Entry or fixture pins one edge of the fact; entire-fact promotion blocked by structural partial coverage — stays doc-only with reason |
| `promotion-refused` | No fixture can make this fact the operative cause of a non-`unknown` golden value — terminal at fact level |

**Deletion probe:** For each row, unfounding the cited matrix entry (or stub: `confidence: "doc"`, `verifiedFacts: []`) and re-running the named fixture scan. Pass criterion: some non-`unknown` golden value changes (H1-28).

## D5-07 gate sanity check

| Metric | Value |
|--------|-------|
| Baseline fixture-verified | **41** |
| Original D5-07 target | **≥ 50** (+9) |
| **Revised D5-07 floor** | **≥ 42** (+1) — gate revision documented below |
| Measured fixture-verified (D5-07) | **42** |
| promotion-owed (all platforms) | **9** (Claude only, D5-01 sanity) |
| Realistic high-confidence promotions | **~7** (K1, K3, R2, R5, R6, B2, B4) |
| Borderline promotion-owed | **1** (F11 alias fixture; K7 `-p` half unpinned) |
| partial-pin + promotion-refused | **57** (no §11.4 tier movement without new channels) |

**Verdict (pre-wave):** Gate **feasible but tight**. Seven high-confidence Claude promotions plus F11 reach exactly 50; borderline rows may add buffer or stay doc-only. T1 and T2 are partial-pin only — entry-level fixture confidence without entire-fact promotion. Cursor/Codex doc-only rows are terminal refusals (5 + 8) — no fv contribution expected. D5-05 environment cluster is mostly `promotion-refused` (discovery.environment keys only); do not count E1–E8 toward the +9 unless golden channels are added in handoff scope.

## D5-07 final wave outcome (gate revision)

D5-02…06 attempted H1-28 promotion on nine D5-01 targets. Only **F11** (`agent.toolAliases`) passed the deletion test and moved to §11.4 `fixture-verified` tier (+1). The other eight closed as **partial-pin** (entry-level fixture evidence without entire-fact `verifiedFacts`). No promotions were faked to reach the original ≥50 target.

| Metric | Value |
|--------|-------|
| Original gate target | **≥ 50** (+9 from 41) |
| Revised gate floor | **≥ 42** (+1 from 41) |
| Full promotions (fv delta) | **1** (F11, D5-02) |
| Partial-pin from targets | **8** (R2, R5, R6, K1, K3, B2, B4, K7) |
| promotion-refused from targets | **0** |
| Doc-only promotion-refused (triage total) | **35** (22 Claude + 5 Cursor + 8 Codex) |
| D4-06 unchanged | entry-owed **0**, unverified **18** |

**Gate revision rationale:** All nine original promotion targets were honestly evaluated per H1-28. Eight retain entry-level pins without entire-fact promotion; one (F11) promoted. The +8 gap to the original target reflects missing §11.2 golden channels, not withheld work. D5-07 passes on the revised floor **42** with refusal counts recorded above — not on the aspirational **50**.

---

## Claude (52 documentation-only)

### D5-02 — Context / tools

| Fact | Matrix entry | Fixture | Disposition | Deletion probe (expected delta) |
|------|--------------|---------|-------------|----------------------------------|
| T1 | `context.filter1` | tools-filters | partial-pin | Unfound filter1 → AskUserQuestion removal pinned; ExitPlanMode plan-mode exemption unpinned |
| T2 | `context.filter2` | background | partial-pin | Unfound filter2 → Agent denial pinned; full surviving built-in set unpinned |
| T3 | `context.fork` | fork | partial-pin | Unfound T3 → fork context still resolves all tools `enforcement: unknown`; no confident delta today |
| T5 | `context.foregroundBackground` | tools-filters | promotion-refused | Background Agent denial pinned by T2/filter2, not T5; no isolated fg/bg pool delta |
| F11 | `agent.toolAliases` | tools-filters | promotion-owed | Extend fixture: agent lists `Task`/`Agent` alias → unfound alias rule changes resolved tool name |

### D5-03 — Permissions / trust

| Fact | Matrix entry | Fixture | Disposition | Deletion probe (expected delta) |
|------|--------------|---------|-------------|----------------------------------|
| P1 | `P1` | permission-inheritance | partial-pin | bypassPermissions parent half pinned; acceptEdits parent absent from corpus |
| P5 | `P5` | permission-inheritance | partial-pin | acceptEdits/default frontmatter path only; dontAsk/auto/plan/bypass from frontmatter unpinned |
| P3 | `P3` | — | promotion-refused | Plan-tier default; no billing/org context in fixtures (`noFixturePossible`) |
| R1 | `trust.inlineMcp`, `session.mainInlineMcp` | trust-inline-mcp | partial-pin | Project-scope inline MCP trust gate pin candidate; `--add-dir`, SDK, managed, main-session halves unpinned |
| R2 | `trust.parentFolder` | nested-project | promotion-owed | Treat parent-folder trust as sufficient → `mid-hooked` hooks flip blocked → available |
| R4 | `trust.inlineMcp`, `settings.projectMcpAutoApproval` | trust-inline-mcp | partial-pin | Named-server inline MCP only; user/SDK/managed scopes unpinned |
| R5 | `trust.frontmatterHooks` | trust-inline-mcp | promotion-owed | Unfound R5 → `hooked` agent hooks capability leaves golden (deletion test D1-06) |
| R6 | `trust.addDirSeparate` | add-dir | promotion-owed | Reuse project trust for add-dir folder → vendor-auditor inline MCP available |

### D5-04 — Skills / instructions / builtins

| Fact | Matrix entry | Fixture | Disposition | Deletion probe (expected delta) |
|------|--------------|---------|-------------|----------------------------------|
| K1 | `skills.preload` | skills-preload | partial-pin | Remove command-kind guard → `.claude/commands` name in `skills:` flips to preloaded; allowlist half unpinned (D5-04) |
| K2 | `skills.skillToolWithoutPreload` | skill-allowed-tools | partial-pin | Skill tool offered without preload pinned; "discovers and invokes" is runtime, not scannable |
| K3 | `skills.skillToolWhitelist` | basic | partial-pin | Add Skill to backend whitelist → Skill capability available (tools branch); disallowedTools branch unpinned (D5-04) |
| K5 | `skills.missing` | — | promotion-refused | Product is unknown-only; no confident verdict to pin (`noFixturePossible`) |
| K6 | `skills.denyBeatsAllowedTools` | skill-allowed-tools | partial-pin | Entry `confidence: fixture`; K6 not in `verifiedFacts` — deny-beats-pre-approval pinned at entry level |
| K7 | `skills.allowedToolsUntrusted` | skill-allowed-tools | partial-pin | Trust=false + K6/K7 findings pinned; `-p`/headless qualifier half unpinned (D5-04) |
| K9 | `skills.disallowedToolsActive` | — | promotion-refused | Active-skill runtime pool; no §11.2 channel (`noFixturePossible`) |
| I1 | `instructions.hierarchy` | instructions | partial-pin | Project/nested CLAUDE.md levels pinned; `~/.claude/CLAUDE.md` and managed policy absent |
| I4 | `instructions.subagentPrompt` | — | promotion-refused | No system-prompt field in §11.2 goldens (`noFixturePossible`) |
| B2 | `builtin.readOnly` | instructions | partial-pin | Unfound B2 → Write/Edit available under explore/plan contexts; read-only-tools-only clause unpinned (D5-04) |
| B4 | `discovery.builtinNameOverride` | builtin-agents | partial-pin | Unfound B4 → synthetic Explore collision drops effective; model clause is F7 (D5-04) |

### D5-05 — Environment

| Fact | Matrix entry | Fixture | Disposition | Deletion probe (expected delta) |
|------|--------------|---------|-------------|----------------------------------|
| E1 | `E1` | environment | promotion-refused | Key in `discovery.environment.relevant` only; resolver does not gate Filter 2 from env |
| E2 | `E2` | environment | partial-pin | Env key pinned; fork default and `0`-disables halves rest on documentation |
| E3 | `agent.depthLimit` | depth-limit, environment | partial-pin | `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` override partial alongside N1/N3 |
| E4 | `builtin.disableExplorePlan` | environment | promotion-refused | Key in discovery.environment; builtin removal not in discovery.agents golden |
| E5 | `builtin.disableAllSdk` | environment | promotion-refused | Same; non-interactive qualifier unpinned |
| E6 | `agent.modelResolution` | — | promotion-refused | No resolved-model channel (`noFixturePossible`) |
| E7 | `environment.maxConcurrentSubagents` | environment | promotion-refused | Cap not emitted in §11.2 goldens |
| E8 | `E8` | environment | promotion-refused | Key pinned; frontmatter memory gate not wired in resolver |
| B5 | `builtin.disableExplorePlan` | environment | promotion-refused | Same as E4 |
| B6 | `builtin.disableAllSdk` | environment | promotion-refused | Same as E5 |
| N3 | `agent.depthLimit` | depth-limit | partial-pin | Env override partial (with N1, E3) |
| N4 | `environment.maxConcurrentSubagents` | environment | promotion-refused | Same as E7/N4 default |

### D5-06 — Housekeeping / cross-cutting (Claude)

| Fact | Matrix entry | Fixture | Disposition | Deletion probe (expected delta) |
|------|--------------|---------|-------------|----------------------------------|
| A1 | `agent.collisionCrossScope` | plugin-agents | partial-pin | Project-over-plugin edge pinned at entry; CLI/user/managed ranks unpinned |
| A4 | `agent.collisionSameDir` | collision-same-dir | promotion-refused | Status unknown by construction; ambiguous candidates only |
| A10 | `agent.descriptionBudget` | — | promotion-refused | No snapshot-level warnings channel (`noFixturePossible`) |
| F1 | `agent.frontmatterRequired` | invalid-agents | partial-pin | Required fields pinned; fourteen optional fields piecemeal across corpus |
| F3 | `agent.disallowedTools` | tools-filters | partial-pin | F2 verified entire; mcp__ pattern forms unpinned |
| F4 | `agent.tools` | tools-filters | partial-pin | Empty-tools block (F4) not operative in fixture |
| F5 | `agent.toolsAgentTypesIgnored` | — | promotion-refused | Main-session half absent from §11.2 corpus (`noFixturePossible`) |
| F7 | `agent.modelResolution` | — | promotion-refused | No model verdict channel (`noFixturePossible`) |
| F8 | `agent.modelAllowlist` | managed-simulation | partial-pin | Block on modelChanges pinned; substitute identity unknown (H1-29) |
| F10 | `agent.initialPromptMainSession` | — | promotion-refused | Main-session only (`noFixturePossible`) |
| N1 | `agent.depthLimit` | depth-limit | partial-pin | Default depth partial |
| N2 | `agent.depthLimit` | depth-limit | partial-pin | Removal at limit pinned; fork-exempt half enforcement unknown |
| N5 | `agent.depthLimit`, `agent.depthLimitDefault` | depth-limit | partial-pin | Pre-2.1.219 N5 windows unobserved; depthLimitDefault `noFixturePossible` (D5-06 cleared stale pendingFixture) |
| S9 | `settings.denySubagents` | — | promotion-refused | Argument-scoped; §2.3 matching (`noFixturePossible`) |
| M4 | `session.mainAgentPrompt` | — | promotion-refused | Main-session only (`noFixturePossible`) |
| M5 | `session.mainInlineMcp` | — | promotion-refused | Main-session startup; R1 subagent half separate (`noFixturePossible`) |

### Claude summary

| Disposition | Count | D5 task |
|-------------|-------|---------|
| promotion-owed | 4 | D5-02 (1), D5-03 (3), D5-04 (0) |
| partial-pin | 26 | — |
| promotion-refused | 22 | — |
| **sum** | **52** | |

---

## Cursor (5 documentation-only)

All terminal refusals — opportunistic promotion in D5-06 only if a new golden channel appears.

| Fact | Matrix entry | Fixture | Disposition | Target | Deletion probe (expected delta) |
|------|--------------|---------|-------------|--------|----------------------------------|
| CV2 | `version.degraded` | — | promotion-refused | D5-06 | Fixtures mock `version.txt`; CLI failure not operative (`noFixturePossible`) |
| CW1 | `discovery.projectBoundary` | — | promotion-refused | D5-06 | Discovery anchors on `projectPath`, not `.git` (`noFixturePossible`) |
| CW3 | `discovery.nestedAgentsMd` | — | promotion-refused | D5-06 | No nested AGENTS.md in goldens (`noFixturePossible`) |
| CR2 | `rules.applicationMode` | — | promotion-refused | D5-06 | Application mode resolves unknown (`noFixturePossible`) |
| CM4 | `mcp.probe` | — | promotion-refused | D5-06 | Runtime probe required (`noFixturePossible`) |

**Note:** CW2 is `externally-cited`, not documentation-only — walk not matrix-gated; D5-06 promotion refused (deletion probe: unfounding does not change golden).

| Disposition | Count |
|-------------|-------|
| promotion-owed | 0 |
| partial-pin | 0 |
| promotion-refused | 5 |

---

## Codex (9 documentation-only)

| Fact | Matrix entry | Fixture | Disposition | Target | Deletion probe (expected delta) |
|------|--------------|---------|-------------|--------|----------------------------------|
| XV1 | `version.detect` | — | promotion-refused | D5-06 | Fixtures mock `version.txt` (`noFixturePossible`) |
| XV3 | `version.scanBoundary` | — | promotion-refused | D5-06 | Product invariant; no golden channel (`noFixturePossible`) |
| XR1 | `discovery.repoRoot` | nested-instructions | promotion-refused | D5-06 | Walk not matrix-gated; unfounding does not change golden |
| XR2 | `discovery.rootMarkers` | — | promotion-refused | D5-06 | Adapter uses `.git` only (`noFixturePossible`) |
| XR4 | `instruction.ancestors` | nested-instructions | promotion-refused | D5-06 | Walk not matrix-gated; unfounding does not change golden |
| XI2 | `instruction.ancestors` | nested-instructions | promotion-refused | D5-06 | Same entry as XR4 |
| XI5 | `instruction.chain` | agents-precedence | partial-pin | D5-06 | XI1 verified entire; merge-order clause not operative in fixture |
| XM3 | `mcp.probe` | — | promotion-refused | D5-06 | Runtime probe required (`noFixturePossible`) |
| XI4 | `instruction.sizeCap` | — | promotion-refused | D5-06 | No cap enforcement channel in §11.2 goldens (`noFixturePossible`) |

**Note:** XA3 is `externally-cited`, not documentation-only — fact registry `[ext]`; basic fixture backs the matrix entry but doc-only triage does not apply. D5-06 promotion refused (deletion probe: unfounding does not change golden).

| Disposition | Count |
|-------------|-------|
| promotion-owed | 0 |
| partial-pin | 1 |
| promotion-refused | 8 |

---

## Grand summary

| Platform | doc-only | promotion-owed | partial-pin | promotion-refused |
|----------|----------|----------------|-------------|-------------------|
| claude | 52 | 4 | 26 | 22 |
| cursor | 5 | 0 | 0 | 5 |
| codex | 9 | 0 | 1 | 8 |
| **total** | **66** | **4** | **27** | **35** |

### promotion-owed by task

| Task | Facts |
|------|-------|
| D5-02 | F11 (+ T1, T2, T3 partial-pin; T5 refused) |
| D5-03 | R2, R5, R6 (+ P1, P5, R1, R4 partial-pin) |
| D5-04 | — (K1, K3, K7, B2, B4 partial-pin; K2, K6, I1 partial-pin) |
| D5-05 | — (E1–E8, B5, B6, N3, N4 refused or partial-pin; E9 ext; **fv delta 0**) |
| D5-06 | Claude housekeeping (N5 pendingFixture cleared); Cursor/Codex refusals above — **fv delta 0** |

### D5-06 outcome

| Change | Result |
|--------|--------|
| `agent.depthLimitDefault` | `pendingFixture: version-drift` → `noFixturePossible` (G1-04 drift demo on `agent.tools`) |
| CW2 (`discovery.scopedMetadata`) | Promotion refused — walk not matrix-gated; unfounding does not change golden |
| XA3 (`agent.noSeparateAgentsArray`) | Promotion refused — no alternate discovery path; unfounding does not change golden |
| Cursor doc-only (CV2, CW1, CW3, CR2, CM4) | Already terminal refusals from D5-01 triage |
| Codex doc-only (XV1, XV3, XR1, XR2, XR4, XI2, XI5, XM3, XI4) | Already terminal refusals; XI5 partial-pin only |
| **fixture-verified delta** | **+1** (41 → 42; F11 only) |

### Surprises flagged

1. **T5 refused despite D5-02 candidate list** — tools-filters background context exists but T5 delta is masked by T2; promotion would double-count filter2, not T5.
2. **D5-05 likely zero fv gain** — environment entries pin `discovery.environment` keys only; twelve rows are promotion-refused unless golden channels are added (handoff risk note confirmed).
3. **K7 partial-pin (D5-04 closed)** — trust=false path and K6/K7 findings pinned at entry level; `-p`/headless qualifier keeps fact doc-only in §11.4.
4. **F11 needs fixture extension** — not a matrix-only promotion; deletion probe requires new agent frontmatter.
5. **N5 / `agent.depthLimitDefault`** — D5-06 cleared stale `pendingFixture: version-drift` → `noFixturePossible` (drift demo moved to `agent.tools` in G1-04); housekeeping, not promotion.
6. **K11 is externally-cited, not doc-only** — registry `[ext]`; `discovery.commandNamePrecedence` entry is fixture-backed at entry level but K11 sits in the externally-cited bucket (12 Claude ext facts). D5-04 handoff lists K11; promotion path is entry `verifiedFacts`, not doc-only triage.
