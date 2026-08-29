# Codex platform facts (MP-02 spike)

Verified corpus for the Capsight Codex adapter. Trust levels: `[doc]` = OpenAI/Codex docs; `[ext]` = external; `[spike]` = local observation only.

**Platform id:** `codex`  
**Adapter root:** `src/adapters/codex/`

---

## 1. Version detection

| ID | Statement | Trust |
|----|-----------|-------|
| XV1 | `codex --version` prints CLI version (e.g. `codex-cli 0.130.0` per GitHub issues) | `[doc]` |
| XV2 | CLI may be absent on PATH — degraded mode: `version: "unknown"` | `[spike]` (not installed on dev machine) |
| XV3 | Only external process in ordinary scan: `codex --version` | `[doc]` (Capsight invariant) |

---

## 2. Config locations and scopes

### 2.1 User scope (`CODEX_HOME`, default `~/.codex`)

| Path | Entity | Notes | Trust |
|------|--------|-------|-------|
| `~/.codex/config.toml` | Settings | User defaults | `[doc]` |
| `~/.codex/AGENTS.md` | Instructions | Global agent instructions | `[doc]` |
| `~/.codex/AGENTS.override.md` | Instructions | Temporary global override | `[doc]` |
| `~/.codex/profile-*.config.toml` | Profile overlays | Selected via `--profile` | `[doc]` |

### 2.2 Project scope (trusted projects only)

| Path | Entity | Notes | Trust |
|------|--------|-------|-------|
| `.codex/config.toml` | Settings | Project overrides; closest wins walking cwd → root | `[doc]` |
| `AGENTS.md` | Instructions | Per-directory; walk root → cwd | `[doc]` |
| `AGENTS.override.md` | Instructions | Overrides `AGENTS.md` in same directory | `[doc]` |
| `.agents/skills/*/SKILL.md` | Skills | Agent skills directory | `[doc]` |

**Trust gate:** Untrusted projects skip project `.codex/` layers (config, hooks, rules) `[doc]`. User/system config still loads.

### 2.3 System scope

| Path | Entity | Trust |
|------|--------|-------|
| `/etc/codex/config.toml` (Unix) | System config | `[doc]` |

---

## 3. Configuration precedence

Highest to lowest `[doc]`:

1. CLI flags / `--config` overrides
2. Project `.codex/config.toml` (root → cwd, closest wins; trusted only)
3. Profile file `~/.codex/<profile>.config.toml`
4. User `~/.codex/config.toml`
5. System config
6. Built-in defaults

**Blocked in project config:** `openai_base_url`, `model_provider`, `profiles`, `notify`, `otel`, etc. — ignored with startup warning `[doc]`.

---

## 4. Instructions discovery

| ID | Statement | Trust |
|----|-----------|-------|
| XI1 | Global: `AGENTS.override.md` else `AGENTS.md` in `CODEX_HOME` (one file) | `[doc]` |
| XI2 | Project: walk root → cwd; per dir check `AGENTS.override.md`, `AGENTS.md`, then `project_doc_fallback_filenames` | `[doc]` |
| XI3 | Fallback filenames (e.g. `CLAUDE.md`) configured via top-level `project_doc_fallback_filenames` in config | `[doc]` |
| XI4 | Combined instruction size capped (`project_doc_max_bytes`, default 32 KiB) | `[doc]` |
| XI5 | Merge order: concatenated root-down; later (closer to cwd) wins for conflicts | `[doc]` |

---

## 5. Settings (TOML)

| ID | Statement | Trust |
|----|-----------|-------|
| XSet1 | Parse TOML for known keys only; unknown keys → `unknownFields` as types, never values | `[ext]` |
| XSet2 | `approval_policy`, sandbox settings affect runtime — resolver v1 may mark `unknown` until fixtured | `[unknown]` |
| XSet3 | MCP servers defined under `[mcp_servers.<name>]` with `command`, `args`, `env` | `[doc]` |
| XSet4 | Redact `env` and secrets — key names only | `[doc]` (§0.1.8) |

**Local spike:** `~/.codex/config.toml` exists with `[mcp_servers.pencil]` entry (command/args only in corpus).

---

## 6. Skills

| ID | Statement | Trust |
|----|-----------|-------|
| XS1 | Skills at `.agents/skills/<name>/SKILL.md` (project) | `[doc]` |
| XS2 | User/global skills path — **unknown** (may mirror `.agents/skills` under CODEX_HOME) | `[unknown]` |
| XS3 | Skill frontmatter conventions — align with Agent Skills open format where documented | `[doc]` |

---

## 7. Agents

| ID | Statement | Trust |
|----|-----------|-------|
| XA1 | Codex primary agent config is instruction-based (`AGENTS.md` chain), not `.md` agent files like Claude | `[doc]` |
| XA2 | Plugin agents (`agents/openai.yaml` in plugins) — discover read-only; semantics **unknown** | `[spike]` |
| XA3 | v1: no separate `agents[]` unless file-based definitions found in project `.codex/` or docs confirm | `[ext]` |

---

## 8. MCP discovery (read-only)

| ID | Statement | Trust |
|----|-----------|-------|
| XM1 | MCP from TOML `[mcp_servers.*]` in user + project config (project if trusted) | `[doc]` |
| XM2 | Transport inferred from `command` (stdio) or `url` (http) | `[doc]` |
| XM3 | Probe requires confirmation (mirror §7.9) | `[doc]` |

---

## 9. Project root

| ID | Statement | Trust |
|----|-----------|-------|
| XR1 | Default project root: directory containing `.git` | `[doc]` |
| XR2 | Customizable via `project_root_markers` in config | `[doc]` |
| XR3 | Walk `.codex/config.toml` from root toward cwd for layered overrides | `[doc]` |
| XR4 | Unlike Cursor (CW5), ancestor `AGENTS.md` files above the scanned path are included on purpose: Codex merges instructions root → cwd (XI2), not workspace-bounded | `[doc]` |

---

## 10. Trust state

| ID | Statement | Trust |
|----|-----------|-------|
| XT1 | Trust is per-project; untrusted → skip project `.codex/` layers | `[doc]` |
| XT2 | Trust storage location / file format — **unknown** until readable on disk (not `~/.claude.json` equivalent documented) | `[unknown]` |
| XT3 | Unreadable trust → `unknown`, not `blocked` (mirror H1-03) | `[doc]` |

---

## 11. Resolver parity (MP-X09+)

Same product surfaces as Claude; many capabilities `unknown` in v1:

- Tool inventory / filters — unknown
- Approval policy → capability mapping — unknown until fixtured
- Subagent depth — unknown
- Version matrix: start minimal; fixture-gated entries only

---

## 12. Fixture plan

Initial golden: `tests/fixtures/codex/basic/`:

- `AGENTS.md`
- `.codex/config.toml` (MCP server with redacted env keys)
- `.agents/skills/example/SKILL.md`

Hermetic: no read of developer's real `~/.codex/` in golden runner (mirror H1-22).

---

## References

- https://learn.chatgpt.com/docs/config-file/config-basic
- https://learn.chatgpt.com/docs/agent-configuration/agents-md
- Local spike: `~/.codex/config.toml` present; `codex` CLI not on PATH
