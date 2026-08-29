# D1-02: Complete the settings-permissions fixture (S8, S9, S10)

## Goal

Turn the five matrix entries that name `pendingFixture: "settings-permissions"` into either fixture-backed evidence or an explicit, reasoned refusal.

## Spec refs

- SPEC §3.5 S8, S9, S10; §4.4 rule 7
- SPEC §11.1–§11.3 (fixtures, gate), §11.4
- H1-28 rule in `matrix.ts` header (when an entry may claim `confidence: "fixture"`)

## Scope IN

- `tests/fixtures/claude/settings-permissions/` — extend `project/` and `expected.json`
- `src/adapters/claude/version/matrix.ts` — `settings.webFetchRules`, `settings.denySubagents`, `settings.denySkills`, `settings.ruleScope`
- `src/adapters/claude/resolution/settings-permissions.ts` — only if a case is unreachable as written

## Scope OUT

- S6 / S7 argument evaluation (D1-03)
- New settings keys (D1-04)

## Design decisions

**Evidence, not decoration.** Per the H1-28 rule an entry may claim `confidence: "fixture"` only when deleting its rule from the resolver would change a **non-`unknown`** value in `expected.json`. The task is therefore to construct cases where each rule is the operative cause — not to add rules to a tree and call it covered.

**`settings.ruleScope` can never be promoted.** Its `status` is `unknown` by construction, and an entry whose status is `unknown` cannot reach `"fixture"` (H1-28). Its `pendingFixture` is misleading and should be removed rather than chased.

**S9 is the cheapest real win:** `permissions.deny: ["Agent(<name>)"]` is `confidence: "doc"` and has an observable effect on the capability set. S10 (`Skill`, `Skill(<name>)`) is the same shape. S8 (`domain:` prefix) is already parsed — the fixture needs a rule whose acceptance or rejection changes an expectation.

**A legitimate outcome is "stays doc-only."** If a rule cannot be made the operative cause of a confident expectation, record why in `notes` and drop `pendingFixture`. Understating evidence is always permissible; overstating it makes §11.4 mean less than it says.

## Acceptance

- [ ] Each of S8, S9, S10 either reaches `confidence: "fixture"` with `verifiedFacts` naming it, or keeps `doc` with a note stating what could not be pinned
- [ ] Every promoted entry passes the deletion test: removing the resolver rule changes a non-`unknown` golden value
- [ ] `settings.ruleScope` loses its `pendingFixture` with the H1-28 reason recorded
- [ ] No entry claims a fact it exercises only partially — `verifiedFacts` covers whole facts only
- [ ] Coverage report re-run and the delta recorded in the task notes

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Five of the twelve `pendingFixture` entries live in this one fixture, which makes it the highest-yield single file in the corpus.
