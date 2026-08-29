# D1-06: Close the remaining pendingFixture entries

## Goal

Work the six matrix entries still carrying `pendingFixture` outside the settings group — A10, F9, K4, K5, R5, B2 — to evidence or to a recorded refusal.

## Spec refs

- SPEC §3 (A10, F9, K4, K5, R5, B2), §11.1–§11.4
- H1-28 rule in `matrix.ts` header

## Scope IN

- `tests/fixtures/claude/invalid-agents/` — `agent.descriptionBudget` (A10)
- `tests/fixtures/claude/plugin-agents/` — `agent.pluginFieldLimits` (F9)
- `tests/fixtures/claude/skills-preload/` — `skills.disableModelInvocation` (K4), `skills.missing` (K5)
- `tests/fixtures/claude/trust-inline-mcp/` — `trust.frontmatterHooks` (R5)
- `tests/fixtures/claude/tools-filters/` — `builtin.readOnly` (B2)
- `src/adapters/claude/version/matrix.ts`

## Scope OUT

- New product behaviour — every rule here already exists in the resolver
- The settings group (D1-02, D1-03)

## Design decisions

**Each fixture directory already exists; what is missing is the case.** The work is constructing an `expected.json` where the named rule is the operative cause of a confident value, per the deletion test in the H1-28 rule.

**Order by yield.** B2 (built-in read-only tool set) and K5 (missing skill) are the most mechanical. F9 is the most valuable — plugin field limits already produced one contradiction in H1-27, so pinning it protects a rule that has been wrong before. R5 touches trust and must not be pinned in a way that asserts a security boundary (§2.4).

**A refusal is a valid deliverable per entry**, with `pendingFixture` removed and the reason recorded. Six entries do not have to become six promotions.

## Acceptance

- [ ] Each of the six entries is either promoted with `verifiedFacts`, or keeps `doc` with `pendingFixture` removed and a reason
- [ ] Every promotion passes the deletion test against a non-`unknown` golden value
- [ ] No fixture reads the developer's own home directories (H1-22 hermeticity)
- [ ] Coverage report re-run; per-platform deltas recorded in the task notes
- [ ] After this task no `pendingFixture` remains anywhere in the Claude matrix

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

`pendingFixture` is the project's own list of evidence it owes itself. Emptying that field is the concrete definition of D1 being finished on the Claude side.
