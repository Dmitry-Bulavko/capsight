# H1-16: Warn that `.agent-manager/` must be gitignored on first write

## Goal

The first time the tool writes into a project's `.agent-manager/`, it tells the user to gitignore that directory.

## Spec refs

- SPEC §12.3 (рекомендовать `.agent-manager/` в `.gitignore` — данные машинно-специфичны)
- SPEC §0.1.8, §13 invariant 10
- H1-01 orchestrator decision (backup byte-copies retain the user's own secrets)

## Scope IN

- src/application/apply.ts, src/application/probe-mcp.ts (first-write sites)
- src/adapters/claude/generation/apply.ts
- src/adapters/claude/probing/mcp-probe.ts
- tests for the warning

## Scope OUT

- Writing to the user's `.gitignore` — the tool must not modify the project (invariant 6); it only warns
- Redacting backup file bytes — settled by the H1-01 decision

## Findings being fixed

Backups byte-copy agent files, so a token in `.claude/agents/x.md` also lives in `.agent-manager/backups/`. That is accepted (invariant 7 needs a faithful restore copy), but only while the directory stays out of version control. §12.3 already calls for recommending the gitignore entry; nothing in the code says it today.

## Acceptance

- [ ] First write into `<project>/.agent-manager/` emits a warning naming the directory and the reason (machine-specific data; may contain copies of your configuration)
- [ ] The warning is not repeated on every write
- [ ] Warning is suppressed when the directory is already covered by the project's ignore rules
- [ ] The tool never edits the user's `.gitignore` itself
- [ ] Warning text does not include any file contents

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Low priority; schedule after the blockers. Raised by the H1-01 implementation, not by the original audit.
