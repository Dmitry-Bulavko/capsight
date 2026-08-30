# Cross-platform compatibility facts (EC-01)

Documented corpus for ecosystem compatibility badges. Trust levels: `[doc]` = official platform docs; `[ext]` = external/community; `[spike]` = local observation only.

**Verdict vocabulary:** `supported` | `not-supported` | `unknown`. `unknown` is the default when no version-gated matrix entry backs a claim (SPEC §8.2). Wording follows SPEC §2.4 — a `not-supported` verdict states what a platform **does not read**, never what "will not work".

**Resource classes** are platform-neutral identifiers in `src/core/compat/resource-class.ts`. Adapters map discovered paths to a class; the corpus states consumption per (class × platform).

**Matrix refs:** Founded `supported` / `not-supported` verdicts cite an entry in `src/adapters/{claude,cursor,codex}/version/matrix.ts` (`COMPAT_MATRIX_ENTRIES`).

---

## 1. Agents — `agent@markdown`

File-based agent definitions (markdown with agent frontmatter).

| ID | Platform | Verdict | Statement | Trust | Matrix / source |
|----|----------|---------|-----------|-------|-----------------|
| EC1 | claude | supported | Claude Code discovers agents from markdown files under configured agents directories | [doc] | `compat.claude.agent-markdown` — SPEC §3.1 A1, A2, A5 |
| EC2 | cursor | supported | Cursor discovers subagents from markdown files under the agents directory | [doc] | `compat.cursor.agent-markdown` — [CURSOR-FACTS.md](./CURSOR-FACTS.md) CA1 |
| EC3 | codex | not-supported | Codex primary agent configuration is instruction-based (AGENTS.md), not markdown agent files | [doc] | `compat.codex.agent-markdown` — [CODEX-FACTS.md](./CODEX-FACTS.md) XA1 |

---

## 2. Skills — `skill@directory`

Agent skills: `SKILL.md` inside a named subdirectory.

| ID | Platform | Verdict | Statement | Trust | Matrix / source |
|----|----------|---------|-----------|-------|-----------------|
| EC4 | claude | supported | Claude Code discovers skills from SKILL.md files in skill directories | [doc] | `compat.claude.skill-directory` — SPEC §3.6 K1 |
| EC5 | cursor | supported | Cursor discovers skills from SKILL.md files in skill subdirectories | [doc] | `compat.cursor.skill-directory` — [CURSOR-FACTS.md](./CURSOR-FACTS.md) CS1 |
| EC6 | codex | supported | Codex discovers skills from SKILL.md files under the agents skills directory | [doc] | `compat.codex.skill-directory` — [CODEX-FACTS.md](./CODEX-FACTS.md) XS1 |

---

## 3. Commands — `command@markdown`

Slash-command markdown files (distinct from skills).

| ID | Platform | Verdict | Statement | Trust | Matrix / source |
|----|----------|---------|-----------|-------|-----------------|
| EC7 | claude | supported | Claude Code discovers slash commands from markdown files under the commands directory | [doc] | `compat.claude.command-markdown` — SPEC §3.6 K11 |
| EC8 | cursor | supported | Cursor discovers slash commands from markdown files under the commands directory | [doc] | `compat.cursor.command-markdown` — [CURSOR-FACTS.md](./CURSOR-FACTS.md) CS3 |
| EC9 | codex | not-supported | Codex does not document slash-command markdown files; configuration is instruction-based | [doc] | `compat.codex.command-markdown` — [CODEX-FACTS.md](./CODEX-FACTS.md) XA1 |

---

## 4. Instructions — `instruction@AGENTS.md`

Shared root/nested `AGENTS.md` instruction files.

| ID | Platform | Verdict | Statement | Trust | Matrix / source |
|----|----------|---------|-----------|-------|-----------------|
| EC10 | claude | not-supported | Claude Code does not read AGENTS.md; it loads the CLAUDE.md instruction hierarchy | [doc] | `compat.claude.instruction-agents-md` — SPEC §3.7 I1 |
| EC11 | cursor | supported | Cursor reads AGENTS.md at the project root and in nested subdirectories | [doc] | `compat.cursor.instruction-agents-md` — [CURSOR-FACTS.md](./CURSOR-FACTS.md) §2.1, CW3 |
| EC12 | codex | supported | Codex walks AGENTS.md files from the repository root toward the working directory | [doc] | `compat.codex.instruction-agents-md` — [CODEX-FACTS.md](./CODEX-FACTS.md) §2.2, XI2 |

---

## 5. Instructions — `instruction@AGENTS.override.md`

Override file that supersedes `AGENTS.md` in the same directory.

| ID | Platform | Verdict | Statement | Trust | Matrix / source |
|----|----------|---------|-----------|-------|-----------------|
| EC13 | claude | not-supported | Claude Code does not read AGENTS.override.md | [doc] | `compat.claude.instruction-agents-override-md` — SPEC §3.7 I1 |
| EC14 | cursor | unknown | Cursor documentation does not state whether AGENTS.override.md is consumed | — | No matrix entry (§8.2) |
| EC15 | codex | supported | Codex prefers AGENTS.override.md over AGENTS.md in the same directory | [doc] | `compat.codex.instruction-agents-override-md` — [CODEX-FACTS.md](./CODEX-FACTS.md) XI1 |

---

## 6. Instructions — `instruction@CLAUDE.md`

Claude Code project/user instruction files.

| ID | Platform | Verdict | Statement | Trust | Matrix / source |
|----|----------|---------|-----------|-------|-----------------|
| EC16 | claude | supported | Claude Code loads CLAUDE.md files in the project instruction hierarchy | [doc] | `compat.claude.instruction-claude-md` — SPEC §3.7 I1 |
| EC17 | cursor | not-supported | Cursor does not read CLAUDE.md; it loads AGENTS.md and project rules | [doc] | `compat.cursor.instruction-claude-md` — [CURSOR-FACTS.md](./CURSOR-FACTS.md) CR3 |
| EC18 | codex | unknown | Codex may load CLAUDE.md only when listed in project_doc_fallback_filenames — not default consumption | [doc] | No matrix entry — [CODEX-FACTS.md](./CODEX-FACTS.md) XI3 |

---

## 7. Instructions — `instruction@CLAUDE.local.md`

Local-only Claude instruction overlay.

| ID | Platform | Verdict | Statement | Trust | Matrix / source |
|----|----------|---------|-----------|-------|-----------------|
| EC19 | claude | supported | Claude Code loads CLAUDE.local.md files in the project instruction hierarchy | [doc] | `compat.claude.instruction-claude-local-md` — SPEC §3.7 I1 |
| EC20 | cursor | not-supported | Cursor does not read CLAUDE.local.md | [doc] | `compat.cursor.instruction-claude-local-md` — [CURSOR-FACTS.md](./CURSOR-FACTS.md) CR3 |
| EC21 | codex | not-supported | Codex does not read CLAUDE.local.md by default | [doc] | `compat.codex.instruction-claude-local-md` — [CODEX-FACTS.md](./CODEX-FACTS.md) XI3 |

---

## 8. Instructions — `instruction@rule-mdc`

Cursor-style rules with `.mdc` frontmatter.

| ID | Platform | Verdict | Statement | Trust | Matrix / source |
|----|----------|---------|-----------|-------|-----------------|
| EC22 | claude | not-supported | Claude Code does not read Cursor rule (.mdc) files | [doc] | `compat.claude.instruction-rule-mdc` — SPEC §3.7 I1 |
| EC23 | cursor | supported | Cursor reads .mdc rule files under the rules directory | [doc] | `compat.cursor.instruction-rule-mdc` — [CURSOR-FACTS.md](./CURSOR-FACTS.md) CR1, CR4 |
| EC24 | codex | not-supported | Codex does not read Cursor rule (.mdc) files | [doc] | `compat.codex.instruction-rule-mdc` — [CODEX-FACTS.md](./CODEX-FACTS.md) XI2 |

---

## 9. Instructions — `instruction@cursorrules`

Legacy single-file Cursor rules at repository root.

| ID | Platform | Verdict | Statement | Trust | Matrix / source |
|----|----------|---------|-----------|-------|-----------------|
| EC25 | claude | not-supported | Claude Code does not read .cursorrules | [doc] | `compat.claude.instruction-cursorrules` — SPEC §3.7 I1 |
| EC26 | cursor | supported | Cursor still reads the legacy .cursorrules file at the repository root | [ext] | `compat.cursor.instruction-cursorrules` — [CURSOR-FACTS.md](./CURSOR-FACTS.md) §2.1 |
| EC27 | codex | not-supported | Codex does not read .cursorrules | [doc] | `compat.codex.instruction-cursorrules` — [CODEX-FACTS.md](./CODEX-FACTS.md) XI2 |

---

## 10. Instructions — `instruction@fallback-doc`

Codex-configured fallback instruction filenames (e.g. CLAUDE.md via `project_doc_fallback_filenames`).

| ID | Platform | Verdict | Statement | Trust | Matrix / source |
|----|----------|---------|-----------|-------|-----------------|
| EC28 | claude | not-supported | Claude Code does not use Codex-style project_doc_fallback_filenames | [doc] | `compat.claude.instruction-fallback-doc` — SPEC §3.7 I1 |
| EC29 | cursor | not-supported | Cursor does not use Codex-style project_doc_fallback_filenames | [doc] | `compat.cursor.instruction-fallback-doc` — [CURSOR-FACTS.md](./CURSOR-FACTS.md) CR3 |
| EC30 | codex | supported | Codex may load filenames listed in project_doc_fallback_filenames when AGENTS.md is absent | [doc] | `compat.codex.instruction-fallback-doc` — [CODEX-FACTS.md](./CODEX-FACTS.md) XI3 |

---

## 11. MCP — `mcp@json-config`

MCP servers declared in JSON configuration (e.g. mcp.json).

| ID | Platform | Verdict | Statement | Trust | Matrix / source |
|----|----------|---------|-----------|-------|-----------------|
| EC31 | claude | supported | Claude Code reads MCP servers declared in project .mcp.json | [doc] | `compat.claude.mcp-json-config` — SPEC §3.8 R4 |
| EC32 | cursor | supported | Cursor reads MCP servers declared in project mcp.json configuration | [doc] | `compat.cursor.mcp-json-config` — [CURSOR-FACTS.md](./CURSOR-FACTS.md) CM1 |
| EC33 | codex | not-supported | Codex does not read JSON mcp.json configuration | [doc] | `compat.codex.mcp-json-config` — [CODEX-FACTS.md](./CODEX-FACTS.md) XM1 |

---

## 12. MCP — `mcp@toml-config`

MCP servers declared in TOML `mcp_servers` blocks.

| ID | Platform | Verdict | Statement | Trust | Matrix / source |
|----|----------|---------|-----------|-------|-----------------|
| EC34 | claude | not-supported | Claude Code does not read Codex TOML mcp_servers blocks | [doc] | `compat.claude.mcp-toml-config` — SPEC §3.8 R4 |
| EC35 | cursor | not-supported | Cursor does not read Codex TOML mcp_servers blocks | [doc] | `compat.cursor.mcp-toml-config` — [CURSOR-FACTS.md](./CURSOR-FACTS.md) CM1 |
| EC36 | codex | supported | Codex reads MCP servers from TOML mcp_servers blocks | [doc] | `compat.codex.mcp-toml-config` — [CODEX-FACTS.md](./CODEX-FACTS.md) XM1 |

---

## 13. MCP — `mcp@inline-agent`

Inline MCP server declarations in agent frontmatter.

| ID | Platform | Verdict | Statement | Trust | Matrix / source |
|----|----------|---------|-----------|-------|-----------------|
| EC37 | claude | supported | Claude Code reads inline mcpServers declared in agent frontmatter | [doc] | `compat.claude.mcp-inline-agent` — SPEC §3.2 F1, §3.8 R1 |
| EC38 | cursor | unknown | Cursor documentation does not state whether agent frontmatter declares inline MCP | — | No matrix entry (§8.2) |
| EC39 | codex | not-supported | Codex does not read inline MCP declarations in agent frontmatter | [doc] | `compat.codex.mcp-inline-agent` — [CODEX-FACTS.md](./CODEX-FACTS.md) XA1 |

---

## 14. Settings — `settings@json`

JSON settings layers (project, user, managed, local).

| ID | Platform | Verdict | Statement | Trust | Matrix / source |
|----|----------|---------|-----------|-------|-----------------|
| EC40 | claude | supported | Claude Code reads settings from JSON settings layers | [doc] | `compat.claude.settings-json` — SPEC §3.5 S1 |
| EC41 | cursor | supported | Cursor may expose readable JSON settings layers where install paths are stable | [ext] | `compat.cursor.settings-json` — [CURSOR-FACTS.md](./CURSOR-FACTS.md) CSet3 |
| EC42 | codex | not-supported | Codex does not read JSON settings layers | [doc] | `compat.codex.settings-json` — [CODEX-FACTS.md](./CODEX-FACTS.md) XSet1 |

---

## 15. Settings — `settings@toml`

TOML configuration layers (Codex config.toml chain).

| ID | Platform | Verdict | Statement | Trust | Matrix / source |
|----|----------|---------|-----------|-------|-----------------|
| EC43 | claude | not-supported | Claude Code does not read Codex TOML config files | [doc] | `compat.claude.settings-toml` — SPEC §3.5 S1 |
| EC44 | cursor | not-supported | Cursor does not read Codex TOML config files | [doc] | `compat.cursor.settings-toml` — [CURSOR-FACTS.md](./CURSOR-FACTS.md) CSet1 |
| EC45 | codex | supported | Codex reads layered config.toml files walking from the repository root toward cwd | [doc] | `compat.codex.settings-toml` — [CODEX-FACTS.md](./CODEX-FACTS.md) XR3 |

---

## Adapter path mapping (not resource classes)

Path patterns stay in adapters. Illustrative mappings:

| Resource class | Claude path | Cursor path | Codex path |
|----------------|-------------|-------------|------------|
| `agent@markdown` | `.claude/agents/**/*.md` | `.cursor/agents/**/*.md` | — |
| `skill@directory` | `.claude/skills/*/SKILL.md` | `.cursor/skills/*/SKILL.md` | `.agents/skills/*/SKILL.md` |
| `command@markdown` | `.claude/commands/**/*.md` | `.cursor/commands/**/*.md` | — |
| `instruction@AGENTS.md` | — | `AGENTS.md` | `AGENTS.md` |
| `mcp@json-config` | `.mcp.json` | `.cursor/mcp.json` | — |
| `mcp@toml-config` | — | — | `[mcp_servers.*]` in config.toml |
| `settings@json` | `.claude/settings*.json` | user settings JSON | — |
| `settings@toml` | — | — | `.codex/config.toml` |

---

## Shared artifacts (many-to-many)

`AGENTS.md` is consumed by **both Cursor (EC11) and Codex (EC12)** with independent matrix entries and source references. A single path can enable detection of multiple platforms (see EC-02).
