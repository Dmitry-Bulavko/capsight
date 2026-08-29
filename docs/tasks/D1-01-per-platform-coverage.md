# D1-01: Per-platform coverage denominator

## Goal

Give Cursor and Codex the §11.4 maturity metric Claude already has, so the depth phase can prove it moved something instead of asserting it.

## Spec refs

- SPEC §11.4 (coverage, not accuracy), §11.3 (correctness gate)
- SPEC §12.2 (adapter structure), §13 invariant 1

## Scope IN

- `tests/fixtures/coverage-report.ts` — parameterize over `(facts, matrix, fixturesRoot)`
- `tests/correctness-gate.test.ts` — assert a report per platform
- `docs/ROADMAP.md` — three coverage lines instead of one

## Scope OUT

- Adding facts or matrix entries (D1-02 … D1-08)
- Any product behaviour

## Design decisions

**The module is Claude-shaped today.** `FIXTURES_ROOT` is hardcoded to `tests/fixtures/claude` and the imports name `adapters/claude/version/facts.js` directly. Generalizing it is mechanical, and it is the reason MP shipped without the gate H1 spent twenty-eight tasks building for Claude.

**Denominators stay separate.** Three reports, never one summed number: the platforms have different fact corpora (92 / ~27 / ~26) and adding them would produce a figure that means nothing and improves whenever a corpus shrinks.

**The metric must be able to fall.** H1-28's lesson holds: a stricter criterion legitimately lowers the count. The gate asserts internal consistency (tiers sum to the denominator, unreferenced facts are `unverified`), never a floor.

## Acceptance

- [ ] `buildCoverageReport` takes a platform's facts, matrix and fixtures root; no Claude path or import remains hardcoded
- [ ] Correctness gate produces and validates a report for each of the three platforms
- [ ] Each report's tiers sum to that platform's own denominator
- [ ] A fact no matrix entry references is `unverified` on every platform, recomputed from the registries rather than trusted from the report
- [ ] ROADMAP records the three baselines as of this task

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Measurement before work. Every later D1 task is judged by its effect on these three numbers, and without this task two of the three do not exist.
