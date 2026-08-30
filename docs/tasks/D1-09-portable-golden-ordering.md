# D1-09: Golden order must not depend on the checkout path

## Goal

Make the golden corpus reproducible from any checkout location, so the suite can run in CI.

## Spec refs

- SPEC §11.2 (fixture contract), §11.3 (correctness gate)
- H1-22 (hermeticity — same principle, third leak)

## Scope IN

- `src/adapters/claude/resolution/resolver.ts` — `sortCapabilities`
- `src/adapters/claude/discovery/instructions.ts` — instruction id derivation
- `tests/fixtures/golden-normalize.ts` — if ordering is normalized rather than fixed at source
- `tests/fixtures/claude/instructions/expected.json`, `tests/fixtures/cursor/basic/expected.json` — re-record if and only if the fix changes the recorded order
- `tests/fixtures/run-golden.test.ts` — a test that pins portability

## Scope OUT

- Any other resolution behaviour
- Other adapters' id schemes, unless they share the defect

## The defect

`instruction.id` is `sha256("instruction:" + absolutePath).slice(0, 16)` (`discovery/instructions.ts:27`). `sortCapabilities` breaks ties on `capabilityId.localeCompare(...)` (`resolution/resolver.ts:852-869`). `golden-normalize.ts` maps capabilities without re-sorting and rewrites the id to a project-relative path only afterwards (:286-291, :336-338).

So the **order** of instruction capabilities in `expected.json` is a function of the absolute path of the checkout. Recomputed for plausible roots:

| Checkout path | `claude/instructions` |
|---|---|
| `/home/user/capsight` | reproduces |
| `/workspace/capsight` | reproduces |
| `/home/alice/capsight` | **reorders** |
| `/Users/bob/dev/capsight` | **reorders** |
| `/home/runner/work/capsight/capsight` | **reorders** — default GitHub Actions path |
| `/srv/ci/build` | **reorders** |

`cursor/basic` has the same exposure through its two instruction capabilities. Pre-existing on `main`; surfaced while implementing D1-00, whose first attempt (relocating fixtures into a temp directory) failed on exactly this.

## Design decisions

**Fix the ordering, not the fixtures.** Re-recording the goldens at the current path would leave them just as unportable. The order must stop depending on an absolute path.

**Prefer a project-relative sort key.** Ordering on the same relative path the normalizer already produces makes the recorded order stable everywhere and human-readable in review. Changing the id itself is the alternative, but ids appear in the API and CLI surfaces, so the narrower change is to the sort.

**Do not make the sort locale-sensitive.** `localeCompare` without an explicit locale varies by environment; that is a second portability leak in the same function and should be closed in the same pass.

**Re-record only if the fix genuinely changes the order**, and say so explicitly in the task notes — a re-record is how an ordering bug hides, so it needs a stated reason.

## Acceptance

- [ ] Instruction capability order is identical for at least three unrelated absolute checkout paths, asserted by a test rather than by inspection
- [ ] The test covers `/home/runner/work/...`-shaped paths specifically
- [ ] Ordering no longer depends on any hash of an absolute path
- [ ] The sort is locale-independent
- [ ] `cursor/basic` is verified for the same defect and fixed if present
- [ ] Any re-recorded `expected.json` is justified in the notes with what changed and why
- [ ] `npm run test` green; `npm run typecheck` clean

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

**The recorded order is lexical and carries no semantic meaning — do not claim otherwise.** The implementation report described the resulting `CLAUDE.local.md, CLAUDE.md, app/CLAUDE.md` as "parents before the scoped file, matching the instruction hierarchy". The review established that this is post-hoc: the order holds only because `.` (0x2E) sorts below `C`, and it contradicts SPEC §3.8 I1, which puts `~/.claude/CLAUDE.md` first and `CLAUDE.local.md` last. Nothing in the code or docs asserts the hierarchy reading, and nothing later should — the sort key exists to be stable across checkouts, not to express precedence. The order it replaced was equally meaningless, so nothing regressed.

Found by the reviewer during D1-00/D1-01. It runs before the rest of the phase because every later D1 task adds fixtures to a corpus that is currently not portable, and because CI cannot be trusted until it is.
