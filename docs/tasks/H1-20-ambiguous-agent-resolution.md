# H1-20: Resolving an ambiguous or shadowed agent must not be silent

## Goal

An agent whose discovery status is `ambiguous` or `invalid` cannot be resolved as if it were a settled configuration.

## Spec refs

- SPEC A4 (следствие: резолвер обязан помечать случай как `ambiguous` и не выбирать победителя)
- SPEC §5 (`Warning.category` includes `"ambiguous-collision"`)
- SPEC §13 invariants 3, 4, 14

## Scope IN

- src/adapters/claude/resolution/resolver.ts (agent lookup and warning emission)
- src/adapters/claude/discovery/agents.ts (only if the status needs surfacing differently)
- tests/fixtures/claude/collision-same-dir/contexts.json (point it at the ambiguous agent once the behaviour is defined)
- tests covering the new warning

## Scope OUT

- Changing how collisions are detected — discovery is correct (A1/A3/A4 verified by H1-09)
- Choosing a winner for A4 — the whole point is that there is none

## Finding

Discovery correctly marks both colliding files `status: "ambiguous"` with two candidates and no `collision.effective`. The resolver then ignores `agent.status` entirely: resolving that name by id returns one candidate's configuration as a settled answer, with no warning. `Warning.category` already declares `"ambiguous-collision"` and nothing in `src/` ever emits it.

This is the §0.1.2 failure mode one layer up from the tool pool: discovery knows it does not know which file wins, and resolution presents one of them as fact. Found while authoring the H1-09 fixtures; `collision-same-dir/contexts.json` was deliberately pointed at an unambiguous agent so the silence would not be blessed in a golden file.

## Acceptance

- [ ] Resolving an `ambiguous` agent emits an `"ambiguous-collision"` warning naming both candidate files
- [ ] Capabilities derived from a contested frontmatter field resolve `unknown` / `enforcement: "unknown"` — the product must not present one candidate's `tools` as the effective set
- [ ] Capabilities that both candidates agree on may stay confident, with the agreement stated as the reason
- [ ] Resolving an `invalid` agent (A7) is refused or resolves entirely `unknown`, never as if the file had loaded
- [ ] `shadowed` agents keep resolving via the winner, with the shadowing recorded as a reason — A3 does define a winner
- [ ] `collision-same-dir/contexts.json` is repointed at the ambiguous agent and its golden records the above

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Raised by the H1-09 implementation. Rank this with the blocker-class tasks rather than the debt ones: it is a confident wrong answer, not missing coverage.
