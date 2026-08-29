# D1-05: K8, K10, K11 — skill overrides and command precedence

## Goal

Give the three skill facts that reach no matrix entry either a founded rule or a recorded reason for staying unverified.

## Spec refs

- SPEC §3.6 K8 (global `deny` beats `allowed-tools`), K10 (`skillOverrides` in settings), K11 (`.claude/commands/` vs `.claude/skills/` name precedence)
- SPEC §11.4, §8.2, M1 acceptance #9 (`[ext]` facts used confidently need a fixture)

## Scope IN

- `src/adapters/claude/resolution/skills.ts`
- `src/adapters/claude/discovery/settings.ts` — `skillOverrides`
- `src/adapters/claude/discovery/skills.ts` — commands directory, for K11 only
- `src/adapters/claude/version/matrix.ts`
- `tests/fixtures/claude/skills-preload/` or a new fixture

## Scope OUT

- K4 / K5 (D1-06 — they have a named pending fixture already)
- Executing or previewing a command

## Design decisions

**All three are `confidence: "ext"`.** Per M1 acceptance #9 none may back a confident conclusion without a fixture. So each lands in exactly one of two states: fixture-backed and acted on, or registered and inert with a note. There is no third state where an `[ext]` fact quietly drives a confident answer.

**K8 is a precedence claim and interacts with D1-02.** "Global `deny` always beats `allowed-tools`" is the same shape as S2 (`deny` not outranked by a higher-priority `allow`). Reuse the existing precedence handling rather than adding a parallel one; if the two facts disagree in some case, that disagreement is the finding.

**K11 changes discovery, not just resolution.** `.claude/commands/*.md` is not discovered at all today. Discovering commands purely to state a precedence rule is scope creep unless the rule is actually founded — establish the evidence first, then decide whether discovery is warranted.

**K10 needs a settings key that may not exist.** `skillOverrides` is `[ext]`. If no documentation or fixture establishes its shape, it stays unverified and the task says so.

## Acceptance

- [ ] K8, K10, K11 each end as fixture-backed with a matrix entry, or unverified with a note naming the missing evidence
- [ ] No `[ext]` fact backs a confident (non-`unknown`) conclusion without a fixture
- [ ] K8 reuses the existing deny-precedence path; any conflict with S2 is recorded rather than smoothed over
- [ ] Command discovery is added only if K11 is founded; otherwise not added
- [ ] Coverage delta recorded in the task notes

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Expect at least one of the three to end unverified. That is a result, not a failure — it is the difference between the corpus knowing what it does not know and pretending otherwise.
