# D1-13: `documentation-only` tier vs fact confidence

## Goal

Make §11.4 coverage honest when a matrix entry cites an `[ext]` or `[spike]` fact: the tier name must not imply official documentation where only a third-party or local claim exists.

## Spec refs

- SPEC §11.4, §8.1, §0.1.1 (fact trust levels)
- H1-28 (coverage tier semantics)
- ROADMAP caveat on `documentation-only`

## Scope IN

- `tests/fixtures/coverage-report.ts` — tier classification, report shape, `formatCoverageReport`
- `tests/correctness-gate.test.ts` — coverage assertions that assume four buckets
- Unit tests for coverage classification (extend existing tests in correctness-gate or add focused test file under `tests/fixtures/`)

## Scope OUT

- Product UI, API, CLI — coverage stays CI-only (SPEC §13 inv 13)
- Changing matrix entries or fixtures
- Claude/Cursor/Codex resolver behaviour

## Design decisions

**Problem:** `entryFactCoverageTier` returns `documentation-only` for any matrix-referenced fact that lacks fixture-verified evidence, regardless of whether `facts.ts` marks the fact `[doc]`, `[ext]`, `[spike]`, or `unknown`. K10 (`[ext]`) and K12 (`[ext]`) therefore read as "documented" in the report.

**Acceptable fixes (pick one, document in notes):**

1. **Split the bucket:** Keep four SPEC tiers but reclassify matrix-referenced non-doc facts into a new CI-only sub-count (e.g. `externally-cited`, `spike-cited`) that sums with `documentation-only` for the referenced-facts check, OR replace `documentation-only` in the report with a breakdown line per trust level.

2. **Rename + restrict:** Rename the current catch-all to `matrix-referenced`; reserve `documentation-only` for facts whose registry confidence is `doc` only. Other referenced facts get an honestly named tier.

**Constraints:**

- Total across buckets must still equal `facts.length` (fixed denominator).
- `fixture-verified` and `runtime-observed` logic unchanged (H1-28 three-condition rule stays).
- `classifyFactCoverage` must accept a `factConfidence` lookup (pass from each platform's `facts.ts` via `buildCoverageReport` signature extension).
- Update ROADMAP caveat once fixed — orchestrator owns ROADMAP, implementer may note suggested text in handoff Notes.

**Test anchors:** K10, K12 (`ext`); K6 (`doc`); facts with `spike` on cursor/codex registries if any are matrix-referenced.

## Acceptance

- [x] A matrix-referenced fact with registry confidence `ext` or `spike` is not counted in `documentation-only` without an explicit, honestly named tier (or sub-line in the report)
- [x] Matrix-referenced `[doc]` facts still classify as documentation-only when not fixture-verified
- [x] `buildCoverageReport` / `classifyFactCoverage` tests cover doc vs ext vs spike vs unreferenced
- [x] `correctness-gate` per-platform coverage test updated and passes
- [x] `formatCoverageReport` output makes the distinction visible to a human reading CI logs

## Done checklist

- [x] `npm run test` passes (coverage tests 45/45)
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)

## Notes

Approach 2 (rename + restrict). New tiers: `externally-cited`, `spike-cited`, `matrix-referenced-unknown`. Claude: documentation-only 34→23, externally-cited 11. K10 moved out of documentation-only.

**Design chosen:** approach 2 (rename + restrict). Matrix-referenced facts without fixture/runtime evidence split into `documentation-only` (`doc`), `externally-cited` (`ext`), `spike-cited` (`spike`), and `matrix-referenced-unknown` (`unknown`). Suggested ROADMAP text: remove the caveat; `documentation-only` now means a matrix entry cites a `[doc]` fact only.
