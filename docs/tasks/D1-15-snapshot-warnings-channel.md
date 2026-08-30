# D1-15: Snapshot-level warnings and A10 refusal wording

## Goal

Close the D1-06 review finding: either add a golden channel for snapshot-level warnings (e.g. A10 description budget), or correct `agent.descriptionBudget`'s `noFixturePossible` text so it does not overstate the obstacle.

## Spec refs

- SPEC §11.2 (golden shape), §7.7 A10
- D1-06 review finding

## Scope IN

- `tests/fixtures/golden-normalize.ts` — optionally extend `NormalizedDiscovery` with `warnings`
- `tests/fixtures/run-golden.test.ts` — wire snapshot warnings into normalized output if channel added
- `src/adapters/claude/version/matrix.ts` — `agent.descriptionBudget` `noFixturePossible` text
- `tests/fixtures/claude/invalid-agents/` or new fixture — only if adding golden channel and a minimal budget-overrun case is feasible without 60k chars verbatim

## Scope OUT

- Changing the 15k threshold or token estimate logic (unit tests already cover)
- UI surfacing of budget warnings
- Cursor/Codex adapters

## Design decisions

**Current state:** Description budget warnings live on `ProjectSnapshot.warnings` (`discovery/description-budget.ts`). Goldens record `discovery` entities + per-resolution `warnings` only — snapshot warnings are dropped in `normalizeGoldenOutput`.

**Acceptable outcomes (pick one):**

1. **Add channel:** Include `snapshot.warnings` in `NormalizedDiscovery.warnings` (sorted, paths normalized). Extend a fixture (e.g. `invalid-agents` if it already has long descriptions, or minimal new case) to pin one budget warning. Promote A10 entry only if deletion test moves a non-unknown golden field.

2. **Honest refusal (minimal):** Reword `noFixturePossible` to say the refusal is **under the current §11.2 golden shape** (snapshot warnings not recorded), not that no field could ever hold the value. Remove overstated "property of no single resolution" if snapshot-level channel is feasible in principle.

Prefer (1) only if a fixture can cross the budget without bloating the corpus; otherwise (2) is the honest deliverable.

## Acceptance

- [ ] A10 `noFixturePossible` no longer overstates the obstacle, OR snapshot warnings appear in at least one golden
- [ ] If channel added: deletion test documented (remove budget rule → warning leaves golden)
- [ ] Existing goldens unchanged except any fixture explicitly extended for budget
- [ ] No security-boundary wording (§2.4)

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

From D1-06 review: the lesser obstacle (60k chars in golden) was cited alongside the structural one; separating "golden shape" from "corpus size" is the fix.
