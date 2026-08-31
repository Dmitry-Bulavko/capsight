# D2-01: Triage all unreferenced facts into a ledger

## Goal

Produce `docs/EVIDENCE-LEDGER.md` classifying every fact that currently reaches no matrix entry across Claude, Cursor, and Codex.

## Spec refs

- SPEC §3 (fact registries)
- SPEC §8.1 (confidence tiers, `noFixturePossible`)
- SPEC §11.4 (coverage denominator, unverified)

## Scope IN

- `docs/EVIDENCE-LEDGER.md` — new ledger artifact
- `tests/fixtures/coverage-report.ts` — use `buildCoverageReport` to enumerate unreferenced facts programmatically
- `src/adapters/claude/version/facts.ts`, `src/adapters/cursor/version/facts.ts`, `src/adapters/codex/version/facts.ts`
- `src/adapters/*/version/matrix.ts` — read matrix `factRefs` only

## Scope OUT

- Adding matrix entries or fixtures (D2-02…D2-04)
- UI changes (D2-05)
- Gate enforcement (D2-06)

## Design decisions

**Measure, don't guess.** Run the project's own `buildCoverageReport` per platform and list facts whose tier is `unverified` (no matrix entry references them).

**Disposition values:** each row gets one of:
- `entry-owed` — D2-02/03/04 should add a matrix entry (and fixture if promotable)
- `noFixturePossible` — permanent refusal with written reason (H1-28 pattern)
- `out-of-scope` — observed layer, v0.2+, or cross-platform compat-only; reason required

**D2-02 scope seed:** mark highest-value Claude facts (resolver/discovery paths that emit confident answers without matrix refs) as `entry-owed` priority 1.

## Acceptance

- [ ] Every unreferenced fact from the three registries appears in the ledger with platform, fact id, disposition, and reason
- [ ] Count matches `buildCoverageReport` unverified totals (87 baseline ±0 unless registries changed)
- [ ] No fact listed twice; compat facts in `src/core/compat/` excluded (separate corpus)
- [ ] Ledger is human-readable markdown table grouped by platform

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

D1 established `noFixturePossible` on matrix entries; D2-01 applies the same concept at the fact level for facts that never got an entry.
