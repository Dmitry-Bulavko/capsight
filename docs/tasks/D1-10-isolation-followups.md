# D1-10: Isolation and portability follow-ups

## Goal

Close the five non-blocking findings the D1-00 and D1-09 reviews raised, so the isolation the phase just built cannot quietly stop working.

## Spec refs

- SPEC §11.2 (fixture contract), §11.3 (correctness gate)
- H1-07 (a gate that passes when it cannot compare is a defect), H1-22

## Scope IN

- `tests/fixtures/fixture-runtime.ts`
- `tests/fixtures/global-setup.ts`
- `tests/fixtures/run-golden.test.ts`, `run-cursor-golden.test.ts`, `run-codex-golden.test.ts`
- `src/application/simulate.ts` — the residual locale-sensitive sorts only
- `.gitignore`

## Scope OUT

- Anything that changes a resolution outcome
- Re-recording a golden, unless finding 4 forces it — and then only with a stated reason

## Findings to close

**1 — An interrupted run can leave an untracked file in the tracked corpus.** `run-golden.test.ts` plants `tests/fixtures/claude/add-dir/.claude/agents/reviewer.md` and removes it in a `finally`. A SIGKILL inside that window leaves it behind, and unlike the `.git` marker it is not covered by any `.gitignore` rule, so an unrelated `git add -A` can commit it. Plant into a copy, or ignore `tests/fixtures/*/*/.claude/`.

**2 — Two concurrent runs in one working tree strip each other's markers.** Marker creation is idempotent in one direction only. If run A finishes while run B is mid-scan, A's teardown removes the markers under B and B silently loses isolation — the exact failure this phase exists to prevent, arriving as a flake. A refcount or lock file closes it.

**3 — The isolation hook is silent when a fixtures root moves, and asserts nothing on two platforms.** `fixtureProjectRoots` returns `[]` for a missing root and `global-setup.ts` never checks how many markers it created. Only Claude has an isolation assertion: the cursor and codex goldens pass with and without `globalSetup`, so a regression there would be invisible. Fail loudly on zero project roots for a declared platform, and assert isolation on all three.

**4 — Residual locale-sensitive sorts in `src/application/simulate.ts:330-338`.** `deniedTools`, `ignoredFields` and `modelChanges` still use bare `localeCompare`, and those lists reach a golden through `NormalizedSimulation`. Latent only because every list in `managed-simulation/expected.json` currently holds one entry; two entries differing by case or punctuation would record differently under another ICU collation. Same defect class D1-09 closed elsewhere.

**5 — Stale doc comment**, `run-golden.test.ts:116-119`: the `fixtureDir` option is documented as used only by the leak demonstration; the portability test now uses it too.

## Design decisions

**Finding 3 is the one that matters.** The other four are hygiene. This phase exists because an isolation gap went unnoticed for months, and the mechanism that closed it is currently unmonitored on two of three platforms and silent when its inputs vanish. A guard that cannot fail is not a guard.

**Do not weaken finding 4 into a normalizer fix.** Sorting in the normalizer would hide a product-code defect behind test scaffolding; `simulate.ts` is where the order is decided.

**A re-record is only acceptable for finding 4**, and only if the comparator change genuinely reorders an existing golden. State what changed and why, as D1-09 did.

## Acceptance

- [ ] No test writes into the tracked corpus, or every path it can write is ignored
- [ ] Concurrent runs in one working tree cannot strip each other's markers — demonstrated, not argued
- [ ] `globalSetup` fails loudly when a declared platform yields zero project roots
- [ ] Cursor and codex each carry an isolation assertion that fails when `globalSetup` is disabled
- [ ] `simulate.ts` sorts are locale-independent; suite passes under `LC_ALL=de_DE.UTF-8`
- [ ] Stale comment corrected
- [ ] `npm run test` green; `npm run typecheck` clean

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Carried from the D1-00 review (findings 1–3) and the D1-09 review (findings 4–5).
