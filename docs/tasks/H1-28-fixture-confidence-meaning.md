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

## Orchestrator verification (post-implementation)

The rule, as written into the matrix header, resolves the three-way contradiction by separating two questions that had been conflated:

- **Entry confidence** answers "what backs *this entry's rule*", and gates enforced verdicts per §8.2. An entry may claim `"fixture"` only when deleting the rule from the resolver would change a *non-`unknown`* value in some fixture's `expected.json`. An `unknown` claims nothing (§11.3), so it cannot be evidence — which is why an entry whose `status` is `unknown` by construction can never reach `"fixture"`.
- **Fact coverage** answers a different question for §11.4, and gets its own field: `verifiedFacts ⊆ factRefs` names only the facts a fixture exercises *entire*. One edge of A1's five-rank order is not the order.

That distinction is the insight. Position 2 from the finding ("a fixture verifies our implementation, not the platform") had to be rejected outright — §8.2 requires the level to be reachable — and positions 1 and 3 turn out not to conflict once the entry and the fact are asked about separately.

**Coverage 15 → 9 of 92, and the direction is the point.** Nine facts were dropped, each with the reason recorded on its entry: A1 and S1 (ranks and layers no fixture loads), S2 (deny pinned at one layer), S3 (its valid forms pinned by nothing), I1 (`~/.claude/CLAUDE.md` and managed policy files absent from the corpus), N5 (two unobserved version windows), N2 (the fork half resolves `unknown`), A4 (unknown by construction), F8 (see below). Four were added after checking them against goldens rather than asserting them. A metric that only ever rises is not measuring anything.

**Three entry-level corrections fell out of the pass**, each a small overclaim: `agent.collisionSameDir` and `agent.depthLimitDefault` dropped to `doc` (neither produces a confident expectation at all), `agent.pluginFieldLimits` to `pendingFixture` (no plugin agent in the corpus declares `hooks`, `mcpServers` or `permissionMode`, so H1-23's fixture reaches the plugin scope but never this rule — its `doc` level was right, its stated reason was not), and P4's fixture pointer moved to the fixture that actually exercises it.

No golden moved: every downgraded entry either cites only `[doc]` facts or already resolved non-`supported`, so no resolver behaviour changed.

**Filed as H1-29:** `managed-simulation` asserts `effective: "claude-sonnet-4"` with `enforcement: "enforced"` for a blocked model, but F8 says only that *a* substitution happens, not which model. The value is our own convention stated as platform fact — §0.1.1 in its purest form.
