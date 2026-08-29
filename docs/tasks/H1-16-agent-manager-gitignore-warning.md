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

## Orchestrator verification (post-implementation)

This task was interrupted mid-flight by an infrastructure limit and finished by a second implementer, which reviewed the partial work rather than restarting it — and found a real defect in it: `isLocalStateIgnored` returned `true` on the first matching ignore source, so a negation in a nearer `.gitignore` could not override a parent's broader rule and the warning was silently dropped. Git resolves that the other way. Fixed by folding decisions least- to most-specific, with the matcher now distinguishing "no rule has an opinion" (`null`) from "not ignored".

Verified on a real git repository:

| situation | result |
|---|---|
| unconfirmed probe preview (nothing written) | no warning — correct, the directory is not created |
| project with `.agent-manager/` in `.gitignore` | no warning |
| after both runs | project's `.gitignore` byte-identical, nothing written |

Suite 395 passed | 1 todo. Accepted.

**Mechanism accepted.** The first-write signal is the absence of `<project>/.agent-manager` on disk, so no marker file is needed and the tool still writes nothing into the project beyond that directory (invariant 6). The in-process set only stops one command that writes twice — backup then history — from warning twice.

**Two limitations, both erring toward warning rather than silence:** `core.excludesFile` is not read, and if `applyFileChanges` throws after the backup created the directory, the warning is lost for that project while the error is surfaced instead. Both fail in the safe direction.
