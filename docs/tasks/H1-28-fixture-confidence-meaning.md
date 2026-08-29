# H1-28: `confidence: "fixture"` does not mean the same thing across entries

## Goal

One stated rule for when a matrix entry may claim fixture confidence, applied uniformly, so the §11.4 metric means something.

## Spec refs

- SPEC §8.1, §8.2 (`confidence: "doc" | "fixture" | "runtime-observed"`)
- SPEC §11.4 (fixed denominator; a monotone, honest maturity metric)
- SPEC §0.1.3 (правило без фикстуры не мержится)

## Scope IN

- src/adapters/claude/version/matrix.ts (the `confidence` value of every entry, and a documented rule in the file header)
- tests/fixtures/coverage-report.ts (`entryCoverageTier`, if the rule needs enforcing there)
- tests/adapters/claude/version/matrix.test.ts

## Scope OUT

- Writing new fixtures
- Changing the §11.4 tiers themselves

## Finding

Three positions are live in the matrix at once, and they contradict each other:

1. `agent.collisionNested` (A3) and `agent.collisionCrossScope` (A1) claim `confidence: "fixture"` while their fixture pins **one edge** of a multi-part rule. A1's fixture covers project-over-plugin; the managed and CLI ranks of its precedence chain are exercised by nothing — discovery reaches a managed layer only through a §7.8 simulation and never reads a CLI layer at all.
2. `agent.pluginFieldLimits` (F9) was deliberately left at `doc` when its fixture landed, on the reasoning that "a fixture verifies our implementation, not the platform".
3. `settings.denyBareTool` (S5) was corrected during H1-21 precisely because it claimed fixture evidence it did not have — there the standard applied was that the fixture must make the rule the operative cause.

Reasoning 2 would make `confidence: "fixture"` unreachable for every entry, which cannot be right since §8.2 requires it before an `[ext]` fact can back an enforced verdict. Reasoning 1 and 3 differ on how much of a rule a fixture must exercise. The metric currently reports 15 facts fixture-verified out of 92; how much of that is real depends on which of these three rules is the actual one, and right now there isn't one.

## Acceptance

- [ ] The rule is written down in the matrix file header, in one or two sentences
- [ ] Every entry's `confidence` is re-checked against it, and any entry that fails is downgraded with a note saying what is missing
- [ ] Where a rule has genuinely separable parts (A1's five ranks, S1's five layers), decide between splitting the entry per part or documenting that the entry claims only its exercised edge — and apply the choice consistently
- [ ] `entryCoverageTier` enforces whatever is decided, rather than trusting the field
- [ ] The coverage report's `fixture-verified` count after the pass is stated in the report, alongside the number before

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Raised by H1-26, which asked the question explicitly rather than picking silently. This is the same class of defect H1-08 fixed one level up: there the denominator was gameable, here the numerator's admission criterion is unstated. A maturity metric with an undefined numerator is not better than one with a movable denominator.
