# MP-C01..C15: Cursor adapter full parity

## Goal

Implement complete Cursor platform adapter: discovery → snapshot → resolver → API/UI → golden fixture. Replace cursor stub in registry with working adapter.

## Spec refs

- docs/CURSOR-FACTS.md (all CV*, CW*, CA*, CS*, CR*, CM*, CSet*, CT* facts)
- SPEC §12.2, §0.1.8 (secret redaction), §6 (unknown)
- Mirror Claude M0–M2 surfaces, not identical §4.4 rules

## Scope IN

- src/adapters/cursor/** (version, discovery, parsing, model, resolution)
- src/adapters/cursor/adapter.ts — wire scan + resolveEffective
- tests/fixtures/cursor/basic/** + golden test
- tests/adapters/cursor/** unit tests as needed
- src/ui/ — platform selector in scan flow (MP-C12)
- src/server/routes/project.ts — platform already wired in MP-04
- tests/correctness-gate.test.ts — register cursor/basic (MP-C15) if gate supports multi-platform

## Scope OUT

- Codex adapter (MP-X*)
- Claude adapter changes (behaviour/goldens must not drift)
- MCP probe execution for cursor (read-only discovery only)
- Write path / M3 generation

## Implementation guide

Mirror structure of `src/adapters/claude/` but use Cursor paths from CURSOR-FACTS.md:

1. **version/detect.ts** — `cursor --version`; degraded unknown
2. **discovery/project-walk.ts** — walk to `.git` root; `.cursor/` at each level
3. **discovery/agents.ts** — `.cursor/agents/**/*.md`; frontmatter name/description; invalid/ambiguous
4. **discovery/skills.ts** — `.cursor/skills/*/SKILL.md`
5. **discovery/instructions.ts** — `.cursor/rules/**/*.mdc`, `AGENTS.md` (root + nested), legacy `.cursorrules`
6. **discovery/mcp.ts** — `.cursor/mcp.json`, `~/.cursor/mcp.json`; redact env keys
7. **discovery/settings.ts** — best-effort user settings JSON if stable path; else empty + advisory
8. **discovery/snapshot.ts** — assemble core `ProjectSnapshot` with `platform: "cursor"`
9. **model/index.ts** + **parsing/frontmatter.ts** — Cursor-specific agent config extension
10. **version/facts.ts** + **matrix.ts** — from CURSOR-FACTS; start minimal
11. **resolution/resolver.ts** — effective config; unverified rules → unknown
12. **UI** — platform dropdown (Claude Code / Cursor / Codex) in scan toolbar; rescan on change
13. **Fixture** `tests/fixtures/cursor/basic/` with expected.json

Reuse core types from `src/core/model/`. Reuse parsing patterns from claude/parsing where format matches (YAML frontmatter).

Register adapter in registry replacing stub.

## Acceptance

- [ ] `scan({ projectPath, platform: "cursor" })` returns valid ProjectSnapshot for capsight repo
- [ ] Agents, skills, rules/instructions, MCP discovered from `.cursor/`
- [ ] `resolveEffective` returns EffectiveConfiguration (capabilities may be mostly unknown — honest)
- [ ] UI platform selector works; scan with cursor shows cursor entities
- [ ] `tests/fixtures/cursor/basic/` golden passes
- [ ] Claude goldens unchanged
- [ ] `npm run test` and `npm run typecheck` pass

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project `.cursor/**`
- [ ] TASKS.md MP-C01..C15 marked done by orchestrator

## Notes

Trust model unknown per CURSOR-FACTS CT1 — use trust state unknown, not blocked.
