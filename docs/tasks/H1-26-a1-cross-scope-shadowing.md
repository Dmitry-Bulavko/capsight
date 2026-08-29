# H1-26: Cross-scope shadowing (A1) is the last ungated collision rule

## Goal

A1 precedence carries the same matrix-derived confidence as A3 and A4 now do.

## Spec refs

- SPEC A1 (managed settings > `--agents` CLI > `.claude/agents/` > `~/.claude/agents/` > plugin `agents/`)
- SPEC §8.2, §6
- SPEC §13 invariant 3

## Scope IN

- src/adapters/claude/version/matrix.ts (an entry for A1)
- src/adapters/claude/discovery/agents.ts, managed-overlay.ts (the `gateCollision` call for the cross-scope branch)
- tests covering it

## Scope OUT

- Changing the precedence order itself, which is correct
- Plugin-scope discovery (H1-23)

## Finding

H1-18 routed A3, A4, A9, A10, K12, F8 and F9 through the matrix. A1 was left out because that task's scope authorised only A9 and K12, and the implementer correctly refused to let `gateCollision` pretend an unregistered rule was gated. The result is visible and deliberate: a cross-scope collision asserts a winner on every version with no `matrixRef` and no `enforcement`, while a nested-directory collision one line away carries both.

A1 is not a safe omission. It decides which of two same-named agents a user actually gets across managed, CLI, project, user and plugin scopes — the highest-stakes shadowing there is — and the product currently states that outcome without saying what backs it.

## Acceptance

- [ ] A matrix entry for A1 with `minVersion`, `status`, `confidence` and either a fixture or a `pendingFixture`
- [ ] The cross-scope branch obtains `matrixRef` and `enforcement` from the matrix, in degraded mode too
- [ ] With the entry unfounded, the cross-scope collision reports undetermined rather than asserting a winner (§8.4)
- [ ] A test covers a managed-over-project and a project-over-user collision
- [ ] `gateCollision` no longer has a path that silently returns un-gated

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Surfaced by H1-18 precisely because that task made every other collision rule gated — the one remaining bare call became obvious. That is the intended effect of making a rule uniform.

## Orchestrator verification (post-implementation)

`gateCollision` now takes a `CollisionRule` union over a total record, so an unregistered rule is a typecheck error rather than a silent un-gated return, and `matrixRef` / `enforcement` are required on the gate result. All six collision emitters in `src/` route through it. Only `plugin-agents/expected.json` moved: the shadowed plugin `reviewer` gains `matrixRef: agent.collisionCrossScope` and `enforcement: "enforced"` while `rule`, `effective` and `status` are unchanged — the project file still beats the plugin file at 2.1.240, and the record now says what backs that. Suite 463 passed. Accepted.

**The A4/A1 distinction is right:** at an unfounded version A1 leaves the group ambiguous with no `effective` (§8.4), but at a supported version the winner stands, because A1 *does* define one. A4 is `unknown` by construction and never names a winner. Those are different situations and the code now treats them differently.

**Coverage across the whole H1 phase, from the report:** `fixture-verified` 0 → 15, `unverified` 66 → 52, denominator fixed at 92 throughout.

**The `fixture` claim is ratified, narrowly, and it exposed something bigger.** `plugin-agents` genuinely pins the project-over-plugin edge of A1, and the same standard was already applied to `agent.collisionNested` for one edge of A3, so the call is consistent with precedent. The entry's note says which edge is pinned and which ranks rest on documentation.

But raising the question showed that `confidence: "fixture"` currently means three different things across the matrix — one edge of a rule here, "a fixture verifies the product not the platform" for F9, and "the fixture must make the rule the operative cause" as enforced during H1-21. Filed as **H1-28**: the numerator of the §11.4 metric has no stated admission criterion, which is the same class of problem H1-08 fixed for the denominator.
