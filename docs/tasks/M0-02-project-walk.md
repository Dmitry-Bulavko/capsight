# M0-02: Project root + upward scope walk

## Goal

From a given project path, walk upward to find git/repo root and collect all `.claude/` scope directories between cwd and root (foundation for agent/skill discovery).

## Spec refs

- SPEC §3.1 A2 — project agents searched upward from cwd; every `.claude/agents/` between cwd and repo root
- SPEC §10 Acceptance M0 #1 — opens existing Claude project read-only

## Scope IN

- `src/adapters/claude/discovery/project-walk.ts` — `walkProjectScopes(startPath)` 
- `src/adapters/claude/discovery/index.ts` — re-export
- `src/application/scan.ts` — include `projectPath` and discovered scope paths in scan result
- `tests/adapters/claude/discovery/project-walk.test.ts` — tests with temp fixture dirs

## Scope OUT

- Agent file parsing (M0-03, M0-04)
- Git detection beyond finding `.git` or walking to filesystem root
- User home `~/.claude/` scope (M0-03)
- UI

## Acceptance

- [x] `walkProjectScopes(path)` returns ordered list of directories from start path up to repo root (inclusive)
- [x] Each entry notes if `.claude/` exists at that level and paths to `.claude/agents/`, `.claude/skills/` if present
- [x] Handles non-git projects (walk until no parent or max depth safety)
- [x] Read-only — no file writes
- [x] `scan()` includes project walk result
- [x] Unit tests with nested fixture directory structure
- [x] `npm run test` and `npm run typecheck` pass

## Done checklist

- [x] npm run test
- [x] npm run typecheck
- [x] no writes to scanned project's .claude/**
- [x] TASKS.md updated by orchestrator (not implementer)

## Notes

Use `path.resolve` for normalization. Repo root = directory containing `.git` or start path if none found walking up.
