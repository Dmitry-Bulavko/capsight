# D4-01: Cursor discovery/walk — matrix entries

## Goal

Close Cursor priority-1 discovery/walk facts marked `entry-owed` in `docs/EVIDENCE-LEDGER.md`.

## Spec refs

- [CURSOR-FACTS.md](../CURSOR-FACTS.md) — CW1, CW2, CW3, CA1, CS1
- SPEC §11.1–§11.4
- H1-28

## Scope IN

- `docs/EVIDENCE-LEDGER.md` — update dispositions for facts closed
- `src/adapters/cursor/version/matrix.ts`
- `tests/fixtures/cursor/` — extend or new fixtures as needed
- `tests/fixtures/run-cursor-golden.test.ts`
- `tests/fixtures/coverage-report.test.ts` — tier movement for D4-01 cluster

## Scope OUT

- Cursor rules/settings (D4-02)
- Codex (D4-03…05)
- UI

## Design decisions

**Target facts:** CW1, CW2, CW3, CA1, CS1.

**Batch:** Close all five or honest `noFixturePossible` with written reason. Do not invent semantics — refusals resolve `unknown` in goldens if touched.

**H1-28:** Fixture promotion only when deleting the matrix rule moves a non-`unknown` golden value. `verifiedFacts` only when fact pinned entire.

## Acceptance

- [ ] Each targeted fact has matrix entry or ledger row moved to `noFixturePossible` with reason
- [ ] New entries follow H1-28 evidence class rules
- [ ] Cursor `unverified` drops by number of facts closed
- [ ] Cursor golden runner passes
- [ ] `npm run test` and `npm run typecheck` pass

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)
