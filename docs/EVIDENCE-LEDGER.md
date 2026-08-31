# Evidence ledger — unreferenced platform facts

Facts that reach no `VERSION_MATRIX` entry are `unverified` in `buildCoverageReport` (SPEC §11.4). This ledger triages every such fact across the three platform registries so none remain silent (D2 gate).

**Measured:** `buildCoverageReport` over `facts.ts` + `VERSION_MATRIX` + declared fixture corpus.

| | claude | cursor | codex | unverified total |
|---|--------|--------|-------|------------------|
| Baseline (`28a510b`, pre-D2) | 47 | 21 | 19 | **87** |
| Current (this ledger) | 35 | 15 | 12 | **62** |

Compat-matrix citations (`COMPAT_MATRIX_ENTRIES` in `src/core/compat/`) do not count toward platform coverage; facts cited only there still appear here.

**Disposition values**

| Disposition | Meaning |
|-------------|---------|
| `entry-owed` | D2-02/03/04 should add a `VERSION_MATRIX` entry (and fixture when promotable under H1-28) |
| `noFixturePossible` | Permanent refusal at fact level — no fixture can make this the operative cause of a confident golden value |
| `out-of-scope` | Deferred beyond D2: observed layer (§9), v0.2+, or product invariant not owned by platform matrix |

---

## Claude (35 unreferenced)

| Fact | § | Conf | Disposition | Priority | Reason |
|------|---|------|-------------|----------|--------|
| T4 | 3.3 | doc | out-of-scope | — | Agent-teams teammate context preserves extra task/cron tools; teammate spawn not modeled in M1 scan goldens (§9 observed layer) |
| T5 | 3.3 | doc | entry-owed | 2 | Same agent definition resolves different tool pools in foreground vs background; `tools-filters` partial coverage, fact unreferenced |
| T6 | 3.3 | doc | noFixturePossible | — | Interactive-session default background when fork mode on (v2.1.232+); session-mode runtime default, not reconstructible from static fixture scan |
| P3 | 3.4 | doc | entry-owed | 2 | `auto` as default on Pro/Max/Team plans; plan-tier default not pinned — matrix entry owed for honest `unknown` when unprovable |
| K7 | 3.6 | doc | entry-owed | 2 | Project-skill `allowed-tools` applies even in never-trusted folder; permission interaction in resolver |
| K9 | 3.6 | doc | entry-owed | 2 | SKILL.md `disallowed-tools` shrinks pool while skill active; resolution rule unreferenced |
| R2 | 3.7 | doc | entry-owed | 2 | Parent-folder trust does not satisfy project-agent trust; trust resolver applies |
| R3 | 3.7 | doc | noFixturePossible | — | Debug-log key `projects["<path>"].hasTrustDialogAccepted` in `~/.claude.json`; not observable in ordinary scan output |
| R6 | 3.7 | doc | entry-owed | 2 | `--add-dir` from outside trusted repo needs separate trust record; trust gate applies |
| I3 | 3.8 | doc | noFixturePossible | — | Platform does not support per-agent instruction assignment; negative fact — every agent gets same hierarchy, no confident per-agent delta to golden |
| I4 | 3.8 | doc | entry-owed | 2 | Subagent system prompt from file body + environment basics, not full Claude Code prompt; resolution emits confident structure |
| I5 | 3.8 | doc | noFixturePossible | — | Git status snapshot at parent-session start; parent runtime state not captured in static fixture scan |
| B1 | 3.9 | doc | entry-owed | 2 | Built-in agent inventory (`Explore`, `Plan`, etc.); discovery lists builtins confidently |
| B3 | 3.9 | doc | noFixturePossible | — | Explore model capped at Opus on Claude API; external API/plan constraint, not fixture-observable |
| B4 | 3.9 | doc | entry-owed | 2 | User agent named `Explore` overrides builtin keeping own `model`; collision/override rule in discovery |
| B5 | 3.9 | doc | entry-owed | 2 | `CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS=1` removes Explore/Plan; env-driven, fixture-promotable via `env.json` |
| B6 | 3.9 | doc | entry-owed | 2 | `CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS=1` removes all builtins in non-interactive/SDK; env-driven |
| N1 | 3.10 | doc | entry-owed | 2 | Default subagent spawn depth 3 (v2.1.219+); depth-limit fixture partial, fact unreferenced |
| N3 | 3.10 | doc | entry-owed | 2 | `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` changes depth limit; env-driven, fixture-promotable |
| N4 | 3.10 | doc | entry-owed | 2 | Concurrent subagent cap 20 via `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`; env-driven |
| E1 | 3.11 | doc | entry-owed | 2 | `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` forces foreground → Filter 1 only; env fixture |
| E2 | 3.11 | doc | entry-owed | 2 | `CLAUDE_CODE_FORK_SUBAGENT` toggles fork mode; `fork` fixture partial, fact unreferenced |
| E3 | 3.11 | doc | entry-owed | 2 | `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` → Agent availability; overlaps N3, matrix should cite |
| E4 | 3.11 | doc | entry-owed | 2 | `CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS=1`; overlaps B5 |
| E5 | 3.11 | doc | entry-owed | 2 | `CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS=1`; overlaps B6 |
| E6 | 3.11 | doc | entry-owed | 2 | `CLAUDE_CODE_SUBAGENT_MODEL` overrides subagent model; env fixture |
| E7 | 3.11 | doc | entry-owed | 2 | `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`; overlaps N4 |
| E8 | 3.11 | doc | entry-owed | 2 | `CLAUDE_CODE_DISABLE_AUTO_MEMORY` disables frontmatter `memory`; env fixture |
| E9 | 3.11 | ext | entry-owed | 2 | Settings `env` block injected per session/tool call; S11 entry partial, E9 itself unreferenced |
| M1 | 3.12 | doc | noFixturePossible | — | Hot-reload of agent dirs without restart; file-watcher runtime behavior, not static scan |
| M2 | 3.12 | doc | noFixturePossible | — | `claude plugin validate <dir>` external CLI subcommand; outside ordinary scan scope |
| M3 | 3.12 | doc | noFixturePossible | — | `/doctor` interactive slash command reports same-name collisions; not produced by scan |
| M4 | 3.12 | doc | entry-owed | 2 | `--agent <name>` replaces main-session system prompt; main-session context not in subagent goldens |
| M5 | 3.12 | doc | entry-owed | 2 | Inline MCP from agent file loads at main-session start; overlaps R1/trust fixtures partially |
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

---

## Cursor (15 unreferenced)

| Fact | § | Conf | Disposition | Priority | Reason |
|------|---|------|-------------|----------|--------|
| CV1 | 1 | spike | noFixturePossible | — | `cursor --version` semver format; version probe is infrastructure, not a resolver golden claim (spike-cited only) |
| CV3 | 1 | ext | noFixturePossible | — | IDE-only installs may lack CLI; machine/environment property, not fixture-observable |
| CW1 | 3 | doc | entry-owed | 1 | Repo root = directory containing `.git`; discovery walk depends on it |
| CW2 | 3 | ext | entry-owed | 1 | Upward walk collecting `.cursor/` metadata; discovery implements |
| CW3 | 3 | doc | entry-owed | 1 | Nested `AGENTS.md` applies in subtree; only compat-matrix cited today |
| CA1 | 4 | doc | entry-owed | 1 | Agent files under `.cursor/agents/**/*.md`; discovery path, compat-only citation |
| CS1 | 5 | doc | entry-owed | 1 | Skills at `.cursor/skills/<name>/SKILL.md`; discovery path |
| CS2 | 5 | unknown | noFixturePossible | — | Skill invocation flags unknown; registry confidence `unknown` — no confident claim possible |
| CR2 | 6 | doc | entry-owed | 1 | `alwaysApply`/`globs` control application mode; resolution rule |
| CR3 | 6 | ext | entry-owed | 2 | Map rules to `instructions[]` type `rule`; discovery mapping |
| CM2 | 7 | spike | noFixturePossible | — | User MCP at `~/.cursor/mcp.json`; home-path layer outside project fixture corpus |
| CSet1 | 8 | spike | noFixturePossible | — | Settings in app user-data directory; OS-specific path, spike only |
| CSet2 | 8 | unknown | noFixturePossible | — | Project-level settings path unknown; registry confidence `unknown` |
| CSet3 | 8 | ext | entry-owed | 2 | Discover readable JSON where paths stable; partial discovery behavior |
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

---

## Codex (12 unreferenced)

| Fact | § | Conf | Disposition | Priority | Reason |
|------|---|------|-------------|----------|--------|
| XV1 | 1 | doc | entry-owed | 1 | `codex --version` prints CLI version; version layer in scan |
| XV2 | 1 | spike | entry-owed | 1 | Degraded mode when CLI missing; adapter behavior |
| XV3 | 1 | doc | entry-owed | 1 | Only `codex --version` allowed in ordinary scan; scan boundary rule |
| XR1 | 2 | doc | entry-owed | 1 | Repo root = directory containing `.git`; walk anchor |
| XR2 | 2 | doc | entry-owed | 1 | Custom root via `project_root_markers`; config-driven root |
| XI3 | 4 | doc | entry-owed | 1 | Fallback instruction filenames from config; discovery rule |
| XI4 | 4 | doc | entry-owed | 1 | Combined instruction size cap; discovery may warn/truncate |
| XS2 | 6 | unknown | noFixturePossible | — | User skills path unknown; registry confidence `unknown` |
| XA1 | 7 | doc | entry-owed | 1 | Instruction-based primary agent config; Codex has no separate agents[] |
| XA3 | 7 | ext | entry-owed | 2 | No separate `agents[]` unless file-based; architectural fact for resolver |
| XSet1 | 5 | ext | entry-owed | 2 | Parse known TOML keys; unknown keys as types; settings parse |
| XT3 | 10 | doc | entry-owed | 1 | Unreadable trust → `unknown` not `blocked`; trust resolver behavior (XT1/2 matrix partial) |

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
claude:T5:entry-owed
claude:T6:noFixturePossible
claude:P3:entry-owed
claude:K7:entry-owed
claude:K9:entry-owed
claude:R2:entry-owed
claude:R3:noFixturePossible
claude:R6:entry-owed
claude:I3:noFixturePossible
claude:I4:entry-owed
claude:I5:noFixturePossible
claude:B1:entry-owed
claude:B3:noFixturePossible
claude:B4:entry-owed
claude:B5:entry-owed
claude:B6:entry-owed
claude:N1:entry-owed
claude:N3:entry-owed
claude:N4:entry-owed
claude:E1:entry-owed
claude:E2:entry-owed
claude:E3:entry-owed
claude:E4:entry-owed
claude:E5:entry-owed
claude:E6:entry-owed
claude:E7:entry-owed
claude:E8:entry-owed
claude:E9:entry-owed
claude:M1:noFixturePossible
claude:M2:noFixturePossible
claude:M3:noFixturePossible
claude:M4:entry-owed
claude:M5:entry-owed
claude:M6:out-of-scope
cursor:CV1:noFixturePossible
cursor:CV3:noFixturePossible
cursor:CW1:entry-owed
cursor:CW2:entry-owed
cursor:CW3:entry-owed
cursor:CA1:entry-owed
cursor:CS1:entry-owed
cursor:CS2:noFixturePossible
cursor:CR2:entry-owed
cursor:CR3:entry-owed
cursor:CM2:noFixturePossible
cursor:CSet1:noFixturePossible
cursor:CSet2:noFixturePossible
cursor:CSet3:entry-owed
cursor:CT2:out-of-scope
codex:XV1:entry-owed
codex:XV2:entry-owed
codex:XV3:entry-owed
codex:XR1:entry-owed
codex:XR2:entry-owed
codex:XI3:entry-owed
codex:XI4:entry-owed
codex:XS2:noFixturePossible
codex:XA1:entry-owed
codex:XA3:entry-owed
codex:XSet1:entry-owed
codex:XT3:entry-owed
```

**Counts by disposition**

| Disposition | Claude | Cursor | Codex | Total |
|-------------|--------|--------|-------|-------|
| entry-owed | 25 | 10 | 11 | 46 |
| noFixturePossible | 11 | 7 | 1 | 19 |
| out-of-scope | 2 | 1 | 0 | 3 |
| **sum** | **35** | **17** | **12** | **64** |
