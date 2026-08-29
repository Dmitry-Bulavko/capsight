# MP-X01..X15: Codex adapter full parity

## Goal

Implement complete Codex platform adapter mirroring Cursor/Claude surfaces. Replace codex stub in registry.

## Spec refs

- docs/CODEX-FACTS.md (XV*, XR*, XI*, XS*, XM*, XSet*, XT* facts)
- SPEC §12.2, §0.1.8, §6

## Scope IN

- src/adapters/codex/** (version, discovery, parsing, model, resolution)
- src/adapters/codex/adapter.ts
- tests/fixtures/codex/basic/** + tests/fixtures/run-codex-golden.test.ts
- tests/adapters/codex/** unit tests
- Hermetic fixtures: do NOT read developer's real ~/.codex/ in golden runner (mirror H1-22)

## Scope OUT

- Claude/Cursor adapter changes
- MCP probe execution
- Write path

## Implementation guide

Mirror `src/adapters/cursor/` structure with Codex-specific paths from CODEX-FACTS.md:

1. **version/detect.ts** — `codex --version`; unknown if CLI missing
2. **discovery/project-walk.ts** — repo root; `.codex/config.toml` layers root→cwd
3. **discovery/instructions.ts** — AGENTS.md / AGENTS.override.md chain; fallbacks from config
4. **discovery/skills.ts** — `.agents/skills/*/SKILL.md`
5. **discovery/mcp.ts** — parse TOML `[mcp_servers.*]` from user + project config; redact env
6. **discovery/settings.ts** — TOML config layers with precedence
7. **discovery/trust.ts** — best-effort; unreadable → unknown
8. **discovery/snapshot.ts** — ProjectSnapshot platform=codex
9. **parsing/** — TOML parser (use existing dep or minimal parse); frontmatter for skills
10. **version/facts.ts** + **matrix.ts**
11. **resolution/resolver.ts** — honest unknown for unverified rules
12. **Fixture** tests/fixtures/codex/basic/ with AGENTS.md, .codex/config.toml, .agents/skills/

Register adapter replacing stub.

## Acceptance

- [ ] `scan({ platform: "codex" })` works on codex/basic fixture
- [ ] Instructions, skills, MCP, settings discovered
- [ ] resolveEffective returns EffectiveConfiguration
- [ ] Golden codex/basic passes
- [ ] Cursor + Claude tests still pass
- [ ] npm run test && npm run typecheck pass (cursor/codex/claude adapter tests at minimum)

## Done checklist

- [ ] npm run test passes (or document pre-existing failures unrelated to codex)
- [ ] npm run typecheck passes
- [ ] No writes to scanned project `.codex/**`
- [ ] TASKS.md MP-X01..X15 marked done by orchestrator
