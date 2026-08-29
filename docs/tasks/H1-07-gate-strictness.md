# H1-07: Correctness gate — corpus completeness and enforcement comparison

## Goal

The gate fails on a missing fixture, on a missing resolution and on a wrong `enforcement`, instead of silently passing on 7 of 20 fixtures.

## Spec refs

- SPEC §11.1 (список из 20 фикстур)
- SPEC §11.2 (контракт фикстуры)
- SPEC §11.3 (единственный блокирующий критерий)

## Scope IN

- tests/fixtures/run-golden.test.ts
- tests/fixtures/coverage-report.ts
- tests/correctness-gate.test.ts

## Scope OUT

- Authoring fixture content — H1-09, H1-10, H1-11
- Coverage denominator — H1-08

## Findings being fixed

1. `run-golden.test.ts:43-52` selects fixtures by `fs.existsSync(.../expected.json)`. The 12 empty directories and `managed-simulation` (which has `project/`, `contexts.json`, `env.json`, `version.txt` but no `expected.json`) generate zero tests, zero skips, zero warnings — the suite reports all-green on 7 of 20.
2. `correctness-gate.test.ts:318-325` asserts that every fixture found by `discoverFixtureNames()` has an `expected.json`, but `discoverFixtureNames()` (`coverage-report.ts:112-123`) is *defined* as "directories containing expected.json". The assertion cannot fail by construction.
3. `coverage-report.ts:88-106` compares only `status`. A capability with a correct `status` but a wrongly `"enforced"` `enforcement` — the exact §8.2 failure mode — is not caught by the gate.
4. `coverage-report.ts:76-79`: an expected resolution the resolver failed to produce is `continue`d over.

## Acceptance

- [ ] The §11.1 list of 20 fixture names is declared explicitly in the test code and compared against the directory listing; a missing or incomplete fixture fails (or is an explicitly registered, listed TODO that the report prints)
- [ ] A fixture directory missing any of `project/`, `env.json`, `version.txt`, `contexts.json`, `expected.json` is reported by name, never silently skipped
- [ ] The gate compares `enforcement` in addition to `status` for confident capabilities
- [ ] An expected resolution with no matching actual resolution is a mismatch, not a `continue`
- [ ] The existing negative tests (`correctness-gate.test.ts:205-268`) still prove the detector fires; add the two new cases (wrong enforcement, missing resolution)
- [ ] `unknown` actual status remains a non-violation (§11.3)

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Landing this before H1-09..H1-11 will turn the suite red until the fixtures are written. That is the intended sequencing — the empty corpus is the finding. If a staged landing is needed, print the missing fixtures as a failing-but-listed set rather than hiding them.

## Orchestrator verification (post-implementation)

The new checks were verified by mutation rather than by reading the tests — each mutation was applied, the gate run, and the fixture restored:

| Mutation | Result |
|---|---|
| flip one golden capability's `enforcement` from `enforced` to `advisory` | gate fails on `claude/basic` — previously passed, since only `status` was compared |
| add a stray `tests/fixtures/claude/stray-dir/` | fails: `has no fixture directory outside the declared §11.1 corpus` |
| add a golden resolution the resolver does not produce | fails with `kind: "missing-resolution"` — previously `continue`d over |

Suite is 296 passed | 13 todo. The 13 incomplete fixtures are reported by name with their missing contract entries, and `EXPECTED_PENDING_FIXTURES` is asserted against the on-disk classification, so the corpus can neither stay silently incomplete nor lose a fixture unnoticed. The tautological completeness test is gone.

**Accepted deviation from the handoff's Notes:** the handoff predicted a red suite until H1-09..H1-11 land. Reporting the gap as counted todos instead is the better outcome — a permanently red suite trains everyone to ignore it, while the declared pending list fails the moment it stops matching reality. H1-09, H1-10 and H1-11 must each shrink `EXPECTED_PENDING_FIXTURES` as they land.
