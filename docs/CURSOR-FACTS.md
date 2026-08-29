# Cursor platform facts (MP-01 spike)

Verified corpus for the Capsight Cursor adapter. Trust levels: `[doc]` = official Cursor docs; `[ext]` = external/community; `[spike]` = local observation only.

**Platform id:** `cursor`  
**Adapter root:** `src/adapters/cursor/`

---

## 1. Version detection

| ID | Statement | Trust |
|----|-----------|-------|
| CV1 | `cursor --version` prints a semver line (observed: `3.16.17` on Windows) | `[spike]` |
| CV2 | Degraded mode when CLI missing or unparsable: `version: "unknown"`, discovery continues read-only | `[doc]` (Capsight invariant §8.3) |
| CV3 | IDE-only installs may lack CLI — version detection is best-effort, not required for discovery | `[ext]` |

**Scan allowance:** only external process in ordinary scan: `cursor --version` (mirror Claude M0 #7).

---

## 2. Config locations and scopes

### 2.1 Project scope

| Path | Entity | Notes | Trust |
|------|--------|-------|-------|
| `.cursor/rules/**/*.mdc` | Rules (instructions) | Plain `.md` in `.cursor/rules/` is **ignored** — needs `.mdc` frontmatter | `[doc]` |
| `.cursor/skills/*/SKILL.md` | Skills | Each skill in its own subdirectory | `[doc]` |
| `.cursor/agents/**/*.md` | Subagents | YAML frontmatter: `name`, `description` required | `[doc]` |
| `.cursor/commands/**/*.md` | Commands | Slash commands; optional frontmatter | `[doc]` |
| `.cursor/hooks/hooks.json` | Hooks | Event → command mappings | `[doc]` |
| `.cursor/mcp.json` | MCP servers | Project-level MCP config | `[doc]` |
| `AGENTS.md` | Instructions | Plain markdown; root and nested subdirs | `[doc]` |
| `.cursorrules` | Instructions (legacy) | Single file at repo root; still supported | `[ext]` |

### 2.2 User scope

| Path | Entity | Notes | Trust |
|------|--------|-------|-------|
| `~/.cursor/mcp.json` | MCP servers | User-global MCP | `[spike]` |
| User Rules (Customize UI) | Instructions | Stored in Cursor app storage, not always as plain files | `[doc]` |
| `~/.cursor/skills/` | Skills | May not exist on all installs; skills also live under project `.cursor/skills/` | `[ext]` |

### 2.3 Team scope

| Source | Entity | Notes | Trust |
|--------|--------|-------|-------|
| Cursor dashboard Team Rules | Instructions | Team/Enterprise; precedence over project rules | `[doc]` |

**Precedence (rules):** Team Rules → Project Rules → User Rules; all applicable merged, earlier wins on conflict `[doc]`.

### 2.4 Plugins

| Path | Entity | Notes | Trust |
|------|--------|-------|-------|
| `.cursor-plugin/plugin.json` | Plugin manifest | Cursor plugin format | `[doc]` |
| `plugin.json` (root) | Agent plugin manifest | Portable Agent Plugins standard | `[doc]` |
| Plugin `skills/`, `rules/`, `agents/`, `mcp.json` | Bundled components | Paths from manifest or folder discovery | `[doc]` |

Capsight v1: discover plugin directories referenced from project; do not execute plugin code.

---

## 3. Project root and upward walk

| ID | Statement | Trust |
|----|-----------|-------|
| CW1 | Repo root: directory containing `.git` (default, mirror Claude A2 walk) | `[doc]` / `[ext]` |
| CW2 | Walk upward from scan path to repo root to locate `.git`; collect `.cursor/` metadata only at the scanned workspace path (CW5) | `[ext]` (Claude pattern, workspace-bounded) |
| CW5 | Capsight treats the scanned `projectPath` as the workspace root — ancestor directories above it (including enclosing git repos) are not scanned for project metadata | `[doc]` (Capsight invariant) |
| CW3 | Nested `AGENTS.md` in subdirectories applies when working in that subtree | `[doc]` |
| CW4 | Same-name collision rules for agents across scopes — **unknown** until fixture-verified | `[unknown]` |

---

## 4. Agent discovery

| ID | Statement | Trust |
|----|-----------|-------|
| CA1 | Agent files: `.cursor/agents/**/*.md` with frontmatter `name`, `description` | `[doc]` |
| CA2 | Invalid agents: missing `name` or `description` → status `invalid` with reason | `[doc]` (mirror A7) |
| CA3 | Same-directory name collision → `ambiguous`, no winner picked | `[ext]` (mirror A4) |
| CA4 | Subagent spawn / tool pool semantics — **unknown** for v1 resolver | `[unknown]` |

---

## 5. Skills

| ID | Statement | Trust |
|----|-----------|-------|
| CS1 | Skill path: `.cursor/skills/<name>/SKILL.md` with frontmatter `name`, `description` | `[doc]` |
| CS2 | User-invoked vs model-invoked skill flags — **unknown** until Cursor docs confirm field names | `[unknown]` |
| CS3 | Commands (`.cursor/commands/`) are distinct from skills; model as `kind: "command"` or separate list | `[doc]` |

---

## 6. Rules and instructions

| ID | Statement | Trust |
|----|-----------|-------|
| CR1 | Rule frontmatter: `description`, `alwaysApply`, `globs` control application mode | `[doc]` |
| CR2 | `alwaysApply: true` → always included; globs → file-scoped; description only → intelligent apply | `[doc]` |
| CR3 | Map rules to core `instructions[]` with `type: "rule"`; `AGENTS.md` → `type: "AGENTS.md"` | `[ext]` |

---

## 7. MCP discovery (read-only)

| ID | Statement | Trust |
|----|-----------|-------|
| CM1 | Project MCP: `.cursor/mcp.json` with `mcpServers` object | `[doc]` |
| CM2 | User MCP: `~/.cursor/mcp.json` | `[spike]` |
| CM3 | Redact `env` values — key names only (§0.1.8) | `[doc]` |
| CM4 | Probe requires explicit confirmation (mirror Claude §7.9) | `[doc]` |

---

## 8. Settings

| ID | Statement | Trust |
|----|-----------|-------|
| CSet1 | Cursor settings JSON lives in app user data (`AppData/Roaming/Cursor/User/` on Windows) | `[spike]` |
| CSet2 | Project-level settings file path — **unknown** (may be UI-only) | `[unknown]` |
| CSet3 | v1: discover readable JSON settings layers where paths are stable; else omit with warning | `[ext]` |

---

## 9. Trust and security

| ID | Statement | Trust |
|----|-----------|-------|
| CT1 | Cursor trust model for project folders — **unknown** (no `~/.cursor.json` equivalent to Claude trust) | `[unknown]` |
| CT2 | Do not write to scanned project `.cursor/**` during scan | `[doc]` (Capsight invariant) |

---

## 10. Resolver parity (MP-C09+)

Cursor resolver v1 should expose the same **surfaces** as Claude (effective, explain, warnings, graph) but many rules resolve `unknown`:

- Tool pool / subagent filters — unknown until tool inventory documented
- Permission modes — unknown
- Context presets — reuse core presets where Cursor subagents map; unmapped → unknown
- Version matrix: start empty; add entries only with fixtures

---

## 11. Fixture plan

Initial golden: `tests/fixtures/cursor/basic/` — minimal project with:

- `.cursor/rules/example.mdc`
- `.cursor/skills/example/SKILL.md`
- `.cursor/agents/example.md`
- `.cursor/mcp.json` (redacted env keys)
- `AGENTS.md`

---

## References

- https://cursor.com/docs/rules
- https://cursor.com/docs/reference/plugins
- Local spike: `cursor --version` → `3.16.17`; `~/.cursor/mcp.json` present; capsight repo `.cursor/rules/`, `.cursor/skills/`
