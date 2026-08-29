# D1-00: Fixture runs must not read Capsight's own `.claude/`

## Goal

Stop the golden corpus from depending on the repository's own agent configuration: a fixture scan currently walks up past the fixture project into `/…/capsight` and discovers Capsight's `.claude/agents/`.

## Spec refs

- SPEC §11.2 (fixture contract), §13 invariant 2
- H1-22 (fixture runs must not read the developer's own `~/.claude/`) — same class, different leak

## Scope IN

- `tests/fixtures/fixture-runtime.ts`
- `tests/fixtures/run-golden.test.ts`, `run-cursor-golden.test.ts`, `run-codex-golden.test.ts`
- `tests/correctness-gate.test.ts` — the `add-dir` gate case
- `docs/DEVELOPMENT.md` — fixture layout note

## Scope OUT

- Changing `project-walk.ts` boundary logic for production scans
- Any change to `expected.json` contents — the goldens are correct; the runner is not
- Adding fixtures (D1-02 onward)

## The defect

`walkProjectScopes` climbs upward until it finds a directory containing `.git` (`project-walk.ts:88-96`). Fixture projects have no `.git`, so the walk does not stop at `tests/fixtures/claude/<name>/project` — it continues to the Capsight repository root and reads the real `.claude/agents/` there.

H1-22 closed the same class of leak for `$HOME`: `fixture-runtime.ts` points `$HOME` at an empty temp directory. The repository root was never isolated, because at the time Capsight's own `.claude/agents/` held one agent (`implementer`) whose name collided with nothing.

Adding `.claude/agents/reviewer.md` to this repository broke five golden assertions, because `tests/fixtures/claude/add-dir/project/.claude/agents/reviewer.md` declares an agent of the same name and the two now collide across scopes (A1). The goldens are right; they were measuring the developer's repository.

**Reproduce:** `git stash` any working changes, delete `.claude/agents/reviewer.md`, run `npm run test` — 542 pass. Restore it — `claude/add-dir`, `claude/collision-nested` (×2), `claude/plugin-agents` and the `add-dir` gate case fail.

## Design decisions

**The real walk must still be exercised.** Do not add a `stopAt` override that only fixtures use: the corpus would then verify a code path production never takes. Isolation belongs in the runner, not in the resolver.

**A tracked path named `.git` is not available.** Git refuses to index a path called `.git`, so the marker cannot simply be committed into each fixture tree. The natural approach is for the runner to materialize each fixture's `project/` into a temp directory and create the `.git` marker there — mirroring what H1-22 did for `$HOME`, and making goldens independent of where the repository is checked out.

**Normalization must keep working.** Golden output is normalized against `project/`; whatever isolation is chosen, recorded paths must stay relative and identical to today's, or `expected.json` files would have to change — and Scope OUT forbids that.

**`cwd.txt` must survive.** Fixtures that exercise the upward walk from a nested cwd (`resolveFixtureScanPath`) must keep doing so, with the fixture project as the new ceiling.

## Acceptance

- [ ] A fixture scan never reads any file under the Capsight repository outside `tests/fixtures/`
- [ ] Adding, renaming or removing an agent in Capsight's own `.claude/agents/` does not change any golden result — asserted by a test, not only by observation
- [ ] All three golden runners and the correctness gate are isolated the same way
- [ ] No `expected.json` is modified
- [ ] `project-walk.ts` production behaviour is unchanged
- [ ] Fixtures using `cwd.txt` still exercise the upward walk
- [ ] `npm run test` returns to a fully green suite

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Found while verifying D1-01. D1 exists to make the corpus trustworthy, and a corpus that changes its verdict when the repository gains an agent is not trustworthy — so this runs before the rest of the phase.
