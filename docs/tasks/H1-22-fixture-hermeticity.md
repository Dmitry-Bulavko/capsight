# H1-22: Fixture runs must not read the developer's own Claude configuration

## Goal

A golden fixture resolves identically on any machine, regardless of the developer's `~/.claude/` contents.

## Spec refs

- SPEC §11.2 (`expected.json` — golden-файл; сравнение детерминированное)
- SPEC §13 invariant 2 (резолвер детерминирован)

## Scope IN

- tests/fixtures/run-golden.test.ts, tests/correctness-gate.test.ts (home isolation for fixture runs)
- src/adapters/claude/environment/index.ts and discovery entry points, only if an injection seam is needed
- tests/fixtures/golden-normalize.ts

## Scope OUT

- Changing what the product reads in production — reading `~/.claude/settings.json` is correct behaviour (S1)

## Finding

`buildPlatformEnvironment` reads the `env` block of `~/.claude/settings.json`, and `discovery.environment` is not scope-filtered, so the user-level layer flows into the golden. On a developer machine carrying a user-level `env` block, the `environment` fixture — and any fixture whose golden records `relevant: []` — fails for reasons that have nothing to do with the change under test. It passes in CI today only because that box has no `~/.claude/settings.json`.

The same exposure applies to trust: `readTrustState` reads `~/.claude.json`, which H1-03's tests already isolate with a temp `$HOME`. The fixture runners do not.

## Acceptance

- [ ] Golden fixture runs execute against a controlled `$HOME` (or an injected home path), so user-level settings and trust cannot reach a golden
- [ ] The `environment` fixture still exercises the settings `env` block via a fixture-owned file rather than the developer's
- [ ] A test proves the isolation: with a user-level `env` block planted in the temp home, the fixture result is unchanged
- [ ] Production behaviour is untouched — the product still reads the real `~/.claude/` when scanning a real project

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Raised by the H1-10 implementation. Low severity for correctness of the product, high severity for trust in the suite: a corpus that fails depending on who runs it gets ignored, and an ignored gate is the failure mode H1-07 just finished fixing.
