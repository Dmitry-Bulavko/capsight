# Evidence ledger — unreferenced platform facts

Facts that reach no `VERSION_MATRIX` entry are `unverified` in `buildCoverageReport` (SPEC §11.4). This ledger triages every such fact across the three platform registries so none remain silent (D2 gate).

**Measured:** `buildCoverageReport` over `facts.ts` + `VERSION_MATRIX` + declared fixture corpus.

| | claude | cursor | codex | unverified total |
|---|--------|--------|-------|------------------|
| Baseline (`28a510b`, pre-D2) | 47 | 21 | 19 | **87** |
| Current (this ledger) | 10 | 7 | 1 | **18** |

Compat-matrix citations (`COMPAT_MATRIX_ENTRIES` in `src/core/compat/`) do not count toward platform coverage; facts cited only there still appear here.

**Disposition values**

| Disposition | Meaning |
|-------------|---------|
| `entry-owed` | D2-02/03/04 should add a `VERSION_MATRIX` entry (and fixture when promotable under H1-28) |
| `noFixturePossible` | Permanent refusal at fact level — no fixture can make this the operative cause of a confident golden value |
| `out-of-scope` | Deferred beyond D2: observed layer (§9), v0.2+, or product invariant not owned by platform matrix |

---

## Claude (10 unreferenced)

| Fact | § | Conf | Disposition | Priority | Reason |
|------|---|------|-------------|----------|--------|
| T4 | 3.3 | doc | out-of-scope | — | Agent-teams teammate context preserves extra task/cron tools; teammate spawn not modeled in M1 scan goldens (§9 observed layer) |
| T6 | 3.3 | doc | noFixturePossible | — | Interactive-session default background when fork mode on (v2.1.232+); session-mode runtime default, not reconstructible from static fixture scan |
| R3 | 3.7 | doc | noFixturePossible | — | Without trust, inline servers skipped and debug log writes `hasTrustDialogAccepted` key; debug-log channel not in static scan |
| I3 | 3.8 | doc | noFixturePossible | — | Platform does not support per-agent instruction assignment; negative fact — every agent gets same hierarchy, no confident per-agent delta to golden |
| I5 | 3.8 | doc | noFixturePossible | — | Git status snapshot at parent-session start; parent runtime state not captured in static fixture scan |
| B3 | 3.9 | doc | noFixturePossible | — | Explore model capped at Opus on Claude API; external API/plan constraint, not fixture-observable |
| M1 | 3.12 | doc | noFixturePossible | — | Hot-reload of agent dirs without restart; file-watcher runtime behavior, not static scan |
| M2 | 3.12 | doc | noFixturePossible | — | `claude plugin validate <dir>` external CLI subcommand; outside ordinary scan scope |
| M3 | 3.12 | doc | noFixturePossible | — | `/doctor` interactive slash command reports same-name collisions; not produced by scan |
| M6 | 3.12 | doc | out-of-scope | — | Agent-teams teammate spawn applies agent `tools`/`model`; teammate runtime feature beyond M1 scan (§9) |

### Closed in D2-02 (priority-1 Claude)

Matrix entries added in `src/adapters/claude/version/matrix.ts`; fixtures where promotable under H1-28.

| Fact | Matrix entry | Evidence |
|------|--------------|----------|
| A2 | `discovery.upwardWalkAgents` | fixture `nested-project`, verified entire |
| A5 | `discovery.recursiveAgentDirs` | fixture `collision-same-dir`, verified entire |
| A6 | `discovery.pluginScopedId` | fixture `plugin-agents`, verified entire |
| A7 | `discovery.invalidAgentSkip` | fixture `invalid-agents`, verified entire |
| A8 | `discovery.pluginFilenameFallback` | fixture `plugin-agents`, verified entire |
| F1 | `agent.frontmatterRequired` | fixture `invalid-agents`, required fields only (doc) |
| F5 | `agent.toolsAgentTypesIgnored` | `noFixturePossible` — subagent half unpinned, main-session half absent from corpus |
| F6 | `agent.toolsMissingAgent` | fixture `tools-filters`, verified entire |
| F7 | `agent.modelResolution` | `noFixturePossible` — no resolved-model channel in §11.2 goldens |
| F10 | `agent.initialPromptMainSession` | `noFixturePossible` — main-session-only, resolution goldens are subagent-only |
| K2 | `skills.skillToolWithoutPreload` | fixture `skill-allowed-tools`, tool-offered half only (doc) |
| K3 | `skills.skillToolWhitelist` | fixture `basic`, tools branch only (doc) |

### Closed in D3-01 (priority-2 env cluster)

Matrix entries added in `src/adapters/claude/version/matrix.ts`; `environment` fixture extended where promotable under H1-28.

| Fact | Matrix entry | Evidence |
|------|--------------|----------|
| B5 | `builtin.disableExplorePlan` | fixture `environment`, discovery.environment only (doc) |
| B6 | `builtin.disableAllSdk` | fixture `environment`, discovery.environment only (doc) |
| N3 | `agent.depthLimit` | fixture `depth-limit`, env override partial (doc) |
| N4 | `environment.maxConcurrentSubagents` | fixture `environment`, discovery.environment only (doc) |
| E1 | `E1` | fixture `environment`, discovery.environment only (doc) |
| E2 | `E2` | fixture `environment`, discovery.environment only (doc) |
| E3 | `agent.depthLimit` | fixture `depth-limit` + `environment`, depth override partial (doc) |
| E4 | `builtin.disableExplorePlan` | fixture `environment`, discovery.environment only (doc) |
| E5 | `builtin.disableAllSdk` | fixture `environment`, discovery.environment only (doc) |
| E6 | `agent.modelResolution` | `noFixturePossible` — no resolved-model channel in §11.2 goldens |
| E7 | `environment.maxConcurrentSubagents` | fixture `environment`, discovery.environment only (doc) |
| E8 | `E8` | fixture `environment`, discovery.environment only (doc) |
| E9 | `environment.settingsEnv` | fixture `environment`, settings.env keys only (doc) |

### Closed in D3-02 (priority-2 trust cluster)

Matrix entries added in `src/adapters/claude/version/matrix.ts`; fixtures extended where promotable under H1-28.

| Fact | Matrix entry | Evidence |
|------|--------------|----------|
| R2 | `trust.parentFolder` | fixture `nested-project`, hooks branch partial (doc) |
| R6 | `trust.addDirSeparate` | fixture `add-dir`, inline MCP partial (doc) |

### Closed in D3-03 (priority-2 discovery/builtins cluster)

Matrix entries added in `src/adapters/claude/version/matrix.ts`; `tools-filters` fixture extended where promotable under H1-28.

| Fact | Matrix entry | Evidence |
|------|--------------|----------|
| T5 | `context.foregroundBackground` | matrix-referenced, documentation-only (tools-filters pins T2 via `context.filter2`, not T5) |
| B1 | `discovery.builtinInventory` | fixture `builtin-agents`, six synthetic scope-builtin agents (fixture-verified) |
| B4 | `discovery.builtinNameOverride` | fixture `builtin-agents`, B4 collision record partial (doc); model clause is F7 |

### Closed in D3-04 (priority-2 skills/instructions/remaining cluster)

Matrix entries added in `src/adapters/claude/version/matrix.ts`; fixtures extended where promotable under H1-28.

| Fact | Matrix entry | Evidence |
|------|--------------|----------|
| P3 | `P3` | `noFixturePossible` — plan tier not discovered in ordinary scan |
| K7 | `skills.allowedToolsUntrusted` | fixture `skill-allowed-tools`, untrusted-folder partial (doc) |
| K9 | `skills.disallowedToolsActive` | `noFixturePossible` — skill-active runtime state, no §11.2 channel |
| I4 | `instructions.subagentPrompt` | `noFixturePossible` — no system-prompt channel in §11.2 goldens |
| N1 | `agent.depthLimit` | fixture `depth-limit`, default depth partial (doc) |
| M4 | `session.mainAgentPrompt` | `noFixturePossible` — main-session-only, subagent goldens only |
| M5 | `session.mainInlineMcp` | `noFixturePossible` — main-session startup; R1 pinned in subagent goldens |

---

## Cursor (7 unreferenced)

| Fact | § | Conf | Disposition | Priority | Reason |
|------|---|------|-------------|----------|--------|
| CV1 | 1 | spike | noFixturePossible | — | `cursor --version` semver format; version probe is infrastructure, not a resolver golden claim (spike-cited only) |
| CV3 | 1 | ext | noFixturePossible | — | IDE-only installs may lack CLI; machine/environment property, not fixture-observable |
| CS2 | 5 | unknown | noFixturePossible | — | Skill invocation flags unknown; registry confidence `unknown` — no confident claim possible |
| CM2 | 7 | spike | noFixturePossible | — | User MCP at `~/.cursor/mcp.json`; home-path layer outside project fixture corpus |
| CSet1 | 8 | spike | noFixturePossible | — | Settings in app user-data directory; OS-specific path, spike only |
| CSet2 | 8 | unknown | noFixturePossible | — | Project-level settings path unknown; registry confidence `unknown` |
| CT2 | 9 | doc | out-of-scope | — | Product read-only invariant (no writes to scanned `.cursor/**`); SPEC §0.1 policy, not a Cursor resolver claim |

### Closed in D2-03 (priority-1 Cursor)

Matrix entries added in `src/adapters/cursor/version/matrix.ts`; fixtures where promotable under H1-28.

| Fact | Matrix entry | Evidence |
|------|--------------|----------|
| CV2 | `version.degraded` | `noFixturePossible` — golden fixtures mock version from `version.txt` |
| CS3 | `discovery.commands` | fixture `basic`, verified entire |
| CR1 | `discovery.ruleFrontmatter` | fixture `ignored-rules`, verified entire |
| CM1 | `discovery.mcpProject` | fixture `basic`, verified entire |
| CM3 | `mcp.envRedact` | fixture `basic`, verified entire |
| CM4 | `mcp.probe` | `noFixturePossible` — resolver marks MCP unknown without probe |

### Closed in D4-01 (priority-1 discovery/walk)

Matrix entries added in `src/adapters/cursor/version/matrix.ts`; fixtures where promotable under H1-28.

| Fact | Matrix entry | Evidence |
|------|--------------|----------|
| CW1 | `discovery.projectBoundary` | `noFixturePossible` — discovery anchors on scanned projectPath, not `.git` markers |
| CW2 | `discovery.scopedMetadata` | fixture `basic`, single-scope walk partial (doc) |
| CW3 | `discovery.nestedAgentsMd` | `noFixturePossible` — nested subdirectory AGENTS.md not in discovery goldens |
| CA1 | `discovery.agents` | fixture `basic`, verified entire |
| CS1 | `discovery.skills` | fixture `basic`, verified entire |

### Closed in D4-02 (priority-1 rules/settings)

Matrix entries added in `src/adapters/cursor/version/matrix.ts`; fixtures where promotable under H1-28.

| Fact | Matrix entry | Evidence |
|------|--------------|----------|
| CR2 | `rules.applicationMode` | `noFixturePossible` — resolver marks instruction application unknown |
| CR3 | `discovery.instructionTypes` | fixture `basic`, verified entire |
| CSet3 | `settings.userJson` | `noFixturePossible` — user settings outside project-scoped golden boundary |

---

## Codex (1 unreferenced)

| Fact | § | Conf | Disposition | Priority | Reason |
|------|---|------|-------------|----------|--------|
| XS2 | 6 | unknown | noFixturePossible | — | User skills path unknown; registry confidence `unknown` |

### Closed in D4-05 (priority-1 settings/architecture)

Matrix entries added in `src/adapters/codex/version/matrix.ts`; fixtures where promotable under H1-28.

| Fact | Matrix entry | Evidence |
|------|--------------|----------|
| XA3 | `agent.noSeparateAgentsArray` | fixture `basic`, documentation-only (doc) |
| XSet1 | `settings.knownKeysOnly` | fixture `basic`, verified entire |

### Closed in D4-04 (priority-1 instructions/trust)

Matrix entries added in `src/adapters/codex/version/matrix.ts`; fixtures where promotable under H1-28.

| Fact | Matrix entry | Evidence |
|------|--------------|----------|
| XI3 | `instruction.fallback` | fixture `instruction-fallback`, verified entire |
| XI4 | `instruction.sizeCap` | `noFixturePossible` — no cap enforcement channel in §11.2 goldens |
| XA1 | `agent.instructionBased` | fixture `basic`, verified entire |
| XT3 | `trust.unreadable` | fixture `basic`, verified entire |

### Closed in D4-03 (priority-1 version/walk)

Matrix entries added in `src/adapters/codex/version/matrix.ts`; fixtures where promotable under H1-28.

| Fact | Matrix entry | Evidence |
|------|--------------|----------|
| XV1 | `version.detect` | `noFixturePossible` — golden fixtures mock version from `version.txt` |
| XV2 | `version.degraded` | `noFixturePossible` — golden fixtures mock version from `version.txt` |
| XV3 | `version.scanBoundary` | `noFixturePossible` — scan boundary invariant not observable in §11.2 goldens |
| XR1 | `discovery.repoRoot` | fixture `nested-instructions`, walk partial (doc) |
| XR2 | `discovery.rootMarkers` | `noFixturePossible` — adapter uses `.git` only, not `project_root_markers` |

### Closed in D2-04 (priority-1 Codex)

Matrix entries added in `src/adapters/codex/version/matrix.ts`; fixtures where promotable under H1-28.

| Fact | Matrix entry | Evidence |
|------|--------------|----------|
| XR3 | `discovery.settings` | fixture `basic`, verified entire |
| XS1 | `discovery.skills` | fixture `basic`, verified entire |
| XS3 | `discovery.skillFrontmatter` | fixture `basic`, verified entire |
| XM1 | `discovery.mcpProject` | fixture `basic`, verified entire |
| XM2 | `mcp.transport` | fixture `basic`, verified entire |
| XSet3 | `discovery.mcpProject` | fixture `basic`, verified entire |
| XSet4 | `mcp.envRedact` | fixture `basic`, verified entire |

---

## Gate index

Stable parse target for D2-06. Format: `platform:factId:disposition`.

```
claude:T4:out-of-scope
claude:T6:noFixturePossible
claude:R3:noFixturePossible
claude:I3:noFixturePossible
claude:I5:noFixturePossible
claude:B3:noFixturePossible
claude:M1:noFixturePossible
claude:M2:noFixturePossible
claude:M3:noFixturePossible
claude:M6:out-of-scope
cursor:CV1:noFixturePossible
cursor:CV3:noFixturePossible
cursor:CS2:noFixturePossible
cursor:CM2:noFixturePossible
cursor:CSet1:noFixturePossible
cursor:CSet2:noFixturePossible
cursor:CT2:out-of-scope
codex:XS2:noFixturePossible
```

**Counts by disposition**

| Disposition | Claude | Cursor | Codex | Total |
|-------------|--------|--------|-------|-------|
| entry-owed | 0 | 0 | 0 | 0 |
| noFixturePossible | 8 | 6 | 1 | 15 |
| out-of-scope | 2 | 1 | 0 | 3 |
| **sum** | **10** | **7** | **1** | **18** |
