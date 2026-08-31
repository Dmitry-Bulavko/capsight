# D2-04: Codex — raise fixture-verified past 2

## Goal

Increase Codex fixture-verified facts above the D1 baseline of 2 by adding matrix depth and fixtures per `docs/EVIDENCE-LEDGER.md`.

## Spec refs

- [CODEX-FACTS.md](../CODEX-FACTS.md)
- SPEC §8, §11.1–§11.4
- H1-28

## Scope IN

- `docs/EVIDENCE-LEDGER.md` — update closed Codex rows
- `src/adapters/codex/version/matrix.ts`, `facts.ts`
- `tests/fixtures/codex/`
- `tests/fixtures/run-codex-golden.test.ts`

## Scope OUT

- Claude (D2-02), Cursor (D2-03)
- UI (D2-05)

## Design decisions

Same H1-28 promotion rules as D2-03. Trust difference between Codex layers stays pinned by existing fixtures.

## Acceptance

- [ ] Codex fixture-verified count > 2 in `buildCoverageReport`
- [ ] At least 1 new or extended fixture with golden update
- [ ] Trust-related facts remain honestly tiered
- [ ] Codex golden runner passes

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)
