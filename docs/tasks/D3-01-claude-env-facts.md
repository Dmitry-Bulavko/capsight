# D3-01: Claude env-driven facts — matrix entries

## Goal

Add matrix entries (and extend fixtures where promotable) for Claude environment-variable facts marked `entry-owed` in `docs/EVIDENCE-LEDGER.md`.

## Spec refs

- SPEC §3.11 (E1–E9)
- SPEC §3.9 (B5, B6)
- SPEC §3.10 (N3, N4)
- SPEC §11.1–§11.4
- H1-28 (`noFixturePossible`, fixture confidence rules)

## Scope IN

- `docs/EVIDENCE-LEDGER.md` — update dispositions for facts closed
- `src/adapters/claude/version/matrix.ts`
- `tests/fixtures/claude/environment/` — extend or new env.json cases
- `tests/fixtures/coverage-report.test.ts` — verify tier movement

## Scope OUT

- Trust facts (D3-02), discovery/builtins (D3-03), skills/instructions (D3-04)
- Cursor/Codex
- UI

## Design decisions

**Target facts:** E1, E2, E3, E4, E5, E6, E7, E8, E9, B5, B6, N3, N4 — dedupe overlaps (E3/E4/E5/E7 share matrix entries with N3/B5/B6/N4 where appropriate).

**Batch size:** Close up to 12 facts; honest `noFixturePossible` with written reason when fixture cannot pin the operative cause.

**No invented semantics:** Env vars the resolver does not read stay `unknown` in goldens; matrix entry documents the fact only.

## Acceptance

- [x] Each targeted fact has a matrix entry or ledger row moved to `noFixturePossible` with reason
- [x] New entries follow H1-28: exactly one of `fixture` / `pendingFixture` / `noFixturePossible`
- [x] Fixture-backed entries have deletion tests or documented impossibility
- [x] Claude `unverified` count drops by at least the number of `entry-owed` facts closed
- [x] `npm run test` and `npm run typecheck` pass

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)

## Notes

Read disposition from `docs/EVIDENCE-LEDGER.md`. D2 closed all Claude priority-1 facts; this batch is priority-2 env cluster.
