# MP-02: Codex platform spike

## Goal

Document verified Codex config corpus for adapter implementation (`docs/CODEX-FACTS.md`).

## Spec refs

- MP plan § MP-0
- SPEC §12.2 (future adapter layout)
- SPEC §0.1.1 (honest unknown)

## Scope IN

- docs/CODEX-FACTS.md
- docs/tasks/MP-02-codex-spike.md

## Scope OUT

- Product code
- Resolver implementation

## Acceptance

- [x] Config paths: `~/.codex/config.toml`, `.codex/config.toml`, AGENTS.md chain, skills, MCP
- [x] Trust gate for project `.codex/` layers documented
- [x] Version detection: `codex --version` + degraded mode
- [x] Fixture plan for `tests/fixtures/codex/basic/`

## Done checklist

- [x] No product code changes
- [ ] TASKS.md updated by orchestrator (MP-03)

## Notes

Spike run 2026-08-29: `codex` CLI not on PATH; `~/.codex/config.toml` present with MCP server entry.
