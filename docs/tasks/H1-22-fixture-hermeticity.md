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

## Added by the orchestrator after H1-20

A second determinism exposure in the same runner, from the same root cause — the corpus depending on the machine rather than on the input:

The golden runner resolves a fixture's agent by `name`. For an A4 collision two snapshot entries share a name, so it silently takes the first. After H1-20 the resolution is candidate-independent in `status` and `enforcement`, but the order of `sources` still reflects which entry was picked, and that order comes from filesystem read order (A4 has no documented rule — that is the whole point of the fact).

- [ ] The runner resolves a fixture agent unambiguously — by id, or by name plus an explicit disambiguator in `contexts.json`
- [ ] `sources` ordering in a resolution is normalized, so a differently-ordered directory walk cannot produce a golden diff
- [ ] A test proves it: resolving the same ambiguous fixture with the candidate order reversed yields an identical golden

## Orchestrator verification (post-implementation)

Verified against the real developer home rather than the test's own temp one: planted `~/.claude/settings.json` with an `env` block and `~/.claude.json` trust records for four fixture projects, then ran the full suite five times. All green, so the corpus genuinely does not see the developer's configuration. Home restored afterwards and confirmed clean.

One run out of the five failed a single test — the H1-25 probe reaping flake, which then passed six times out of six in isolation. Worth noting because it is the second time that flake has muddied a verification: an intermittent failure does not only waste a run, it makes every unrelated result harder to trust. H1-25 is the right priority.

Suite 449 passed | 1 todo. Accepted.

**A latent bug in the runners, found and fixed here, is the more valuable half of this task.** Both runners restored the environment with `process.env = { ...snapshot }`. Reassigning `process.env` replaces Node's live environment binding with an ordinary object, after which `os.homedir()` — which reads the real environment — stops seeing writes to `$HOME`. With that in place the home isolation would have worked for the first fixture and silently done nothing for every one after it, and the failure would only ever appear in a full-file run, never under `-t`. In other words the isolation this task adds would have looked correct while being inert.

**Ambiguous agent selection is now explicit.** Requiring `agentSourcePath` when a name matches more than one entry caught not just `collision-same-dir` (A4) but `collision-nested` (A3) too — both had been silently resolving whichever entry the directory walk yielded first. The reversal proof reverses `snapshot.agents` and every `collision.candidates` list and gets a byte-identical golden.

**Three goldens rewrote by ordering only**, from applying the new sort keys to existing values. `reasons` is deliberately left unsorted: its order is the narrative of how the verdict was reached (declared, then denied), which is content rather than presentation.

**Production untouched:** no `src/` change was needed. The product still reads the real `~/.claude/` when scanning a real project, which is correct per S1.
