# MP-01: Cursor platform spike

## Goal

Document verified Cursor config corpus for adapter implementation (`docs/CURSOR-FACTS.md`).

## Spec refs

- MP plan § MP-0
- SPEC §12.2 (future adapter layout)
- SPEC §0.1.1 (honest unknown)

## Scope IN

- docs/CURSOR-FACTS.md
- docs/tasks/MP-01-cursor-spike.md

## Scope OUT

- Product code
- Resolver implementation

## Acceptance

- [x] Config paths documented: rules, skills, agents, MCP, instructions, plugins
- [x] Scope model: project / user / team
- [x] Version detection: `cursor --version` + degraded mode
- [x] Collision/trust marked known vs unknown
- [x] Fixture plan for `tests/fixtures/cursor/basic/`

## Done checklist

- [x] No product code changes
- [ ] TASKS.md updated by orchestrator (MP-03)

## Notes

Spike run 2026-08-29: `cursor --version` → 3.16.17; capsight repo has `.cursor/rules`, `.cursor/skills`; user `~/.cursor/mcp.json` observed.
