# H1-18: Gate discovery and simulate verdicts through the matrix

## Goal

Matrix entries that describe discovery- and simulation-level conclusions actually gate those conclusions.

## Spec refs

- SPEC §8.2 (фича без записи в матрице резолвится как `unknown`)
- SPEC §13 invariant 11
- SPEC A3, A4, A10, F8, F9

## Scope IN

- src/adapters/claude/discovery/agents.ts, managed-overlay.ts, description-budget.ts
- src/application/simulate.ts
- src/adapters/claude/resolution/plugin.ts
- tests covering those paths

## Scope OUT

- Resolver capability sites — already gated by H1-04
- Adding new matrix entries — H1-06 added these five

## Finding

Five matrix entries have no capability-producing site and are therefore never consulted: `agent.collisionSameDir` (A4), `agent.collisionNested` (A3), `agent.descriptionBudget` (A10), `agent.modelAllowlist` (F8), `agent.pluginFieldLimits` (F9). These paths emit `Warning`s and collision records rather than `ResolvedCapability`, so H1-04's gate does not reach them — the same "registered but inert" pattern the audit found for the matrix as a whole.

## Acceptance

- [ ] Collision records, description-budget findings, model-substitution findings and plugin field limits obtain their confidence from the matrix, in degraded mode too
- [ ] A warning whose backing entry is unsupported at the detected version, or absent, is reported as undetermined rather than asserted
- [ ] `agent.collisionSameDir` stays `unknown` (A4 has no documented winner rule) and the A4 ambiguity remains winner-free
- [ ] No version comparison appears outside `src/adapters/claude/version/`

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Raised by the H1-04 implementation. `Warning` has no `enforcement` field today; decide whether it needs one or whether an undetermined warning is expressed through its category.
