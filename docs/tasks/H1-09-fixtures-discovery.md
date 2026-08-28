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
