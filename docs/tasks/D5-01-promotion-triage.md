# D5-01: Promotion triage — doc-only → promotion-owed or refusal

## Goal

Classify every matrix-referenced `documentation-only` fact per platform into `promotion-owed`, `partial-pin`, or `promotion-refused` so wave 5 tasks do not guess.

## Spec refs

- SPEC §8.1, §11.4
- H1-28 (verifiedFacts + deletion test criterion)

## Scope IN

- `docs/EVIDENCE-PROMOTION.md` (new)
- Cross-read: `docs/EVIDENCE-LEDGER.md`, `tests/fixtures/coverage-report.ts`
- Optional: lightweight script or test helper listing doc-only facts per platform

## Scope OUT

- Matrix or fixture edits (D5-02…06)
- UI
- Lowering H1-28 bar

## Method

For each doc-only fact:
1. Name the matrix entry(ies) citing it
2. Name the fixture (if any)
3. Run or describe deletion probe: does unfounding change a non-`unknown` golden value?
4. Assign disposition: `promotion-owed` | `partial-pin` | `promotion-refused` (with reason)

Pre-assign clusters to D5-02…05 per ROADMAP D5 scope note; flag surprises.

## Acceptance

- [x] All Claude doc-only facts (52) classified
- [x] Cursor/Codex doc-only facts classified (5 + 9)
- [x] Each `promotion-owed` row names target task (D5-02…06)
- [x] D5-07 gate target (fv ≥ 50) sanity-checked
- [x] `npm run test` and `npm run typecheck` pass

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)
