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

## Added by the orchestrator after H1-11

A9 and K12 (`--add-dir` contributing `.claude/agents/` and `.claude/skills/`) now have a fixture proving the behaviour, but no matrix entry, so they raise no §11.4 coverage. Every existing entry backs a resolver rule with a `gateCapability` call site, and add-dir is discovery-level — the same category question this task already covers for A3/A4/A10/F8/F9.

- [ ] Decide whether discovery-level facts belong in the version matrix at all, and record the decision here
- [ ] If they do, add entries for A9 and K12 alongside the five this task already covers

## Orchestrator verification (post-implementation)

Suite 414 passed | 1 todo. Seven goldens moved and each change is justified. Accepted.

**Decision accepted: discovery-level facts do belong in the matrix.** §8.2 governs a *feature*, not a capability shape, and §6 requires every product claim to carry an enforcement status — §6 names the A4 collision as its own example of `unknown`. "The nearest nested directory wins" is a version-sensitive platform claim exactly as `disallowedTools` is; only the shape of the output differs. Gating by output type rather than by content would have left the five entries inert, which was the finding.

**`Warning.enforcement` as a separate optional field is right.** Category says what the warning is about, enforcement says how sure we are; folding doubt into the category would delete the finding in order to record the uncertainty. Optional is also right: a §7.6 security finding reports configuration read directly and makes no platform claim, so there is nothing to gate.

**The gate caught a real defect in the H1-09 fixtures.** `collision-nested` and `nested-project` asserted an A3 winner while pinning version 2.1.0 — but A3 is documented only from v2.1.178. A fixture cannot demonstrate a rule at a version where the rule does not exist, so the pin was the defect, now 2.1.178. At 2.1.177 or an unknown version the resolver marks the group `ambiguous` with no winner, per §8.4. This is the second time the corpus has repaid the work of filling it.

**A4 unchanged where it matters:** both `reviewer` records stay `ambiguous`, winner-free, now carrying `matrixRef: agent.collisionSameDir` and `enforcement: "unknown"` — the entry is `status: "unknown"` by construction, so A4 reads undetermined on every version.

**Scope expansion accepted:** `skills.ts` was touched though not listed, because it is K12's only possible call site and an entry with no consumer is the exact pattern this task exists to remove.

**Filed as H1-26:** A1 cross-scope shadowing is now the only ungated collision rule. The implementer was right not to fake a gate for an unregistered fact, and right to flag it.

**Still pending, correctly:** `agent.pluginFieldLimits` has a call site and unit coverage but no fixture until plugin discovery exists (H1-23); `agent.descriptionBudget` has a call site but no oversized-description fixture case, so it stays `confidence: "doc"`.
