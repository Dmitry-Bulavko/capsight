# H1-09: Fixture batch — discovery ambiguity and invalid files

## Goal

Populate the four fixtures that cover the product's headline value: the files and collisions Claude Code stays silent about.

## Spec refs

- SPEC §11.1, §11.2
- SPEC A2, A3, A4, A7
- SPEC §10 Acceptance M0 #4, #5

## Scope IN

- tests/fixtures/claude/invalid-agents/ (A7 — all four causes)
- tests/fixtures/claude/collision-same-dir/ (A4 — ambiguous, no winner)
- tests/fixtures/claude/collision-nested/ (A3 — winner determined)
- tests/fixtures/claude/nested-project/ (A2, A3)

## Scope OUT

- Resolver changes; discovery already implements A1/A3/A4/A7 (`discovery/agents.ts:115-259`)
- The remaining fixtures — H1-10, H1-11

## Findings being fixed

All four directories are `.gitkeep`-only, so A4 `ambiguous` and A7 invalid-reason behaviour has no golden coverage at all despite being M0 acceptance criteria #4 and #5.

## Acceptance

- [ ] Each fixture has `project/`, `env.json`, `version.txt`, `contexts.json`, `expected.json` per §11.2
- [ ] `invalid-agents/` covers all four A7 causes: no `name`; `name` starting with `-` or containing `:`; `name` without `description`; unparseable YAML
- [ ] `collision-same-dir/` produces `status: "ambiguous"` with `collision.candidates` populated and **no** `collision.effective` (A4)
- [ ] `collision-nested/` produces `status: "shadowed"` with the cwd-nearest file winning and `collision.rule` = the A3 matrix ref
- [ ] `nested-project/` exercises the upward walk from cwd with `.claude/agents/` at more than one level
- [ ] Golden comparison is deterministic across runs (entity order normalized)

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

A8 (plugin agent without `name` still loads under the file name) belongs to `plugin-agents/` in H1-11, not here.

## Added by the orchestrator after H1-06 and H1-08

Beyond writing fixture content, each fixture task must close the loop on the matrix:

- [ ] Flip every matrix entry this task satisfies from `pendingFixture` to `fixture`
- [ ] Promote that entry's `confidence` from `"doc"` to `"fixture"` **only** after reading the fixture and confirming it actually exercises the rule — a directory existing is not evidence
- [ ] Shrink `EXPECTED_PENDING_FIXTURES` in `tests/correctness-gate.test.ts` accordingly; the corpus test fails until it matches reality

## Orchestrator verification (post-implementation)

Read the generated goldens directly rather than trusting the run:

```
collision-same-dir:  reviewer  ambiguous  rule=A4  candidates=2  effective=absent   (x2)
                     planner   active
invalid-agents:      broken-yaml         invalid  bad-yaml
                     colon-name          invalid  bad-name-chars
                     dash-name           invalid  bad-name-chars
                     missing-description invalid  no-description
                     missing-name        invalid  no-name
                     auditor             active
```

No `expected.json` in the corpus contains an absolute path. Suite is 306 passed | 9 todo, down from 13 pending fixtures to 9. Accepted.

**Contract extension accepted:** an optional `cwd.txt` naming a directory inside `project/` to scan from. Without it A2/A3 were untestable — `walkProjectScopes` only walks upward, so two `.claude/agents/` levels could not both sit inside a fixture whose scan root was `project/`. The file is additive and the five §11.2 entries are unchanged, but §11.2 itself does not mention it; the SPEC should gain a line, which is the document owner's call.

**Normalizer bug found and fixed in passing:** `normalizeDiscovery` normalized `agent.source` but not `collision.candidates` / `collision.effective`, so the first goldens carried absolute paths. No previous fixture had a collision, so nothing caught it. This is exactly why the empty corpus was dangerous.

**Filed as H1-20:** the resolver ignores `agent.status` — resolving an ambiguous agent silently returns one candidate's configuration, though `Warning.category` already declares an unused `"ambiguous-collision"`. Discovery knows it does not know; resolution asserts anyway.

**`agent.descriptionBudget` correctly left pending:** it covers A10, which this fixture does not exercise, and `snapshot.warnings` is not part of the normalized golden at all. Promoting it would have been the false claim this whole task exists to prevent.
