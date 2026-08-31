# D2-02: Claude — entries for highest-value unreferenced facts

## Goal

Add matrix entries (and fixtures where promotable) for the highest-priority Claude facts marked `entry-owed` in `docs/EVIDENCE-LEDGER.md`.

## Spec refs

- SPEC §3, §8.2, §11.1–§11.4
- H1-28 (`noFixturePossible`, fixture confidence rules)

## Scope IN

- `docs/EVIDENCE-LEDGER.md` — update dispositions for facts closed in this task
- `src/adapters/claude/version/matrix.ts`
- `tests/fixtures/claude/` — new or extended fixtures as needed
- `tests/fixtures/coverage-report.ts` — verify tier movement

## Scope OUT

- Cursor/Codex (D2-03, D2-04)
- UI (D2-05)
- Observed layer (§9)

## Design decisions

**Batch size:** Close all D2-01 `entry-owed` priority-1 Claude facts, or the top 8–12 if the ledger lists more — whichever is smaller. Do not attempt all 47 Claude unverified in one task.

**Honest refusals:** Facts that cannot be fixture-promoted get matrix entries with `noFixturePossible: true` and a written reason, not silent omission.

**No invented semantics:** Refused facts resolve `unknown` in goldens if touched; never confident wrong answers.

## Acceptance

- [ ] Each targeted fact either has a new matrix entry or an updated ledger row moved to `noFixturePossible` with reason
- [ ] New entries follow H1-28: exactly one of `fixture` / `pendingFixture` / `noFixturePossible`
- [ ] Fixture-backed entries have deletion tests or documented impossibility
- [ ] Claude `unverified` count drops by at least the number of `entry-owed` facts closed
- [ ] Golden suite remains green

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Read disposition and priority from `docs/EVIDENCE-LEDGER.md` produced by D2-01.
