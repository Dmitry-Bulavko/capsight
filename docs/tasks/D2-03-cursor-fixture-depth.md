# D2-03: Cursor — raise fixture-verified past 3

## Goal

Increase Cursor fixture-verified facts above the D1 baseline of 3 by adding matrix depth and fixtures per `docs/EVIDENCE-LEDGER.md`.

## Spec refs

- [CURSOR-FACTS.md](../CURSOR-FACTS.md)
- SPEC §8, §11.1–§11.4
- H1-28

## Scope IN

- `docs/EVIDENCE-LEDGER.md` — update closed Cursor rows
- `src/adapters/cursor/version/matrix.ts`, `facts.ts`
- `tests/fixtures/cursor/`
- `tests/fixtures/run-cursor-golden.test.ts`

## Scope OUT

- Claude (D2-02), Codex (D2-04)
- Fourth platform
- UI (D2-05)

## Design decisions

**H1-28 criterion:** A fact counts as fixture-verified only when removing the matrix entry or fixture changes a golden verdict — not merely adding an entry.

**CT1 stays unknown:** Do not promote Cursor trust facts beyond what fixtures prove.

## Acceptance

- [ ] Cursor fixture-verified count > 3 in `buildCoverageReport`
- [ ] At least 2 new or extended fixtures with golden updates
- [ ] Each promotion has a deletion test or `noFixturePossible` refusal
- [ ] Cursor golden runner passes

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)
