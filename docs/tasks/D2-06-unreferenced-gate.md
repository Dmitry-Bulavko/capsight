# D2-06: Coverage gate — unreferenced count cannot rise

## Goal

Add a correctness-gate assertion that every fact in all three registries is either matrix-referenced or explicitly listed in `docs/EVIDENCE-LEDGER.md` with a terminal disposition.

## Spec refs

- SPEC §11.3 (correctness gate)
- SPEC §11.4 (coverage)

## Scope IN

- `tests/correctness-gate.test.ts`
- `tests/fixtures/coverage-report.ts` — helper to cross-check ledger vs report if needed
- `docs/EVIDENCE-LEDGER.md` — machine-readable section or parsed table

## Scope OUT

- New facts without ledger rows (should fail the gate)
- UI

## Design decisions

**Fail closed:** Adding a fact to `facts.ts` without matrix ref AND without ledger row fails CI.

**Ledger format:** Add a `## Gate index` section to EVIDENCE-LEDGER with `platform:factId:disposition` lines for stable parsing, or parse markdown tables — implementer's choice.

## Acceptance

- [ ] Gate test fails if any unverified fact lacks a ledger disposition
- [ ] Gate test passes on current corpus after D2-02…04
- [ ] Dispositions `noFixturePossible` and `out-of-scope` satisfy the gate (fact is not silent)

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)
