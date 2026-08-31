# SS-03: S11 — additionalDirectories relative path resolution

## Goal

Resolve relative `permissions.additionalDirectories` entries honestly — §3.5 does not define resolution; product must not guess absolute paths while still reporting more than verbatim unknown where evidence allows.

## Spec refs

- SPEC §3.5 S11
- SPEC §2.3
- Existing `settings.additionalDirectories` matrix entry (D1-04)

## Scope IN

- `src/adapters/claude/resolution/settings-permissions.ts` — additionalDirectories capabilities
- `src/adapters/claude/version/matrix.ts` — extend notes / confidence if pinned
- `tests/fixtures/claude/settings-permissions/`

## Scope OUT

- `--add-dir` trust (A9/K12)
- S6/S7 (SS-01/02)

## Acceptance

- [ ] Relative entries (`../vendor-lib`) get honest status — resolved relative to project root when documentable, or unknown with specific reason
- [ ] Absolute entries unchanged or improved
- [ ] Fixture golden updated; deletion test for additionalDirectories branch
- [ ] `npm run test` and `npm run typecheck` pass

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)
