# SS-02: S7 — Read/Edit path glob anchoring

## Goal

Evaluate `Read(...)` / `Edit(...)` permission rules for path-glob anchoring per S7 — `/` = project root, `//` = absolute — without per-path approval (§2.3).

## Spec refs

- SPEC §3.5 S7
- SPEC §2.3
- D1-03 question 2

## Scope IN

- `src/adapters/claude/resolution/settings-permissions.ts`
- `src/adapters/claude/version/matrix.ts` — `settings.pathRules`
- `tests/fixtures/claude/settings-permissions/`
- `tests/adapters/claude/resolution/settings-permissions.test.ts`

## Scope OUT

- S6 (SS-01)
- S11 relative paths (SS-03)

## Acceptance

- [ ] `Read(/...)` and `Edit(//...)` rules report anchored glob shape via S7, not generic unknown
- [ ] Fixture pins `/` vs `//` anchoring as operative cause; H1-28 deletion test
- [ ] `noFixturePossible` removed from `settings.pathRules` when fixture pins
- [ ] `npm run test` and `npm run typecheck` pass

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)
