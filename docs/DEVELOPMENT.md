# Capsight development notes

## Spec

Implementation contract: [SPEC.md](./SPEC.md)

## Tracking

| Doc | Purpose |
|-----|---------|
| [ROADMAP.md](./ROADMAP.md) | Phase status, current focus, gates |
| [TASKS.md](./TASKS.md) | Atomic backlog — one `in_progress` at a time |
| [tasks/_TEMPLATE.md](./tasks/_TEMPLATE.md) | Handoff template for implementer |
| [tasks/{ID}.md](./tasks/) | Per-task handoff packets |
| [CONTINUATION.md](./CONTINUATION.md) | Live state and operating rules for the D1 phase; delete when it closes |

## Iteration workflow

```
ROADMAP (phase) → TASKS (pick one) → handoff → implementer → reviewer → verify → update docs → next task
```

**Rule:** from task **#04 onward** in each phase (M0-04, M1-04, …) — implementer only. Orchestrator autonomously advances 04 → 05 → … when asked to continue.

1. Orchestrator reads [TASKS.md](./TASKS.md) and [ROADMAP.md](./ROADMAP.md).
2. Sets one task `in_progress`; writes `docs/tasks/{ID}.md`.
3. Delegates to implementer (Cursor Task or `@implementer` in Claude Code).
4. Implementer returns; orchestrator delegates to **reviewer** — a separate agent, so the code is not reviewed by whoever wrote it.
5. Reviewer returns a verdict; orchestrator runs `npm run test` + `npm run typecheck` itself.
6. On `fail`, back to step 3 with the findings. On `pass`, marks task `done`; updates Current focus in ROADMAP.
7. If continuing autonomously and next task is still ≥ #04 — go to step 1 (fresh subagent).

Roles are defined in:

- Orchestrator: `.cursor/rules/capsight-orchestration.mdc`
- Implementer: `.cursor/skills/capsight-implementer/SKILL.md`, `.claude/agents/implementer.md`
- Reviewer: `.cursor/skills/capsight-reviewer/SKILL.md`, `.claude/agents/reviewer.md`

The reviewer exists for two reasons: an agent reviewing its own diff reconstructs its reasoning charitably rather than checking it, and a fresh context costs less than carrying the implementation transcript into review.

## Orchestrator prompt template (Task tool)

```
Task: Implement Capsight task {ID}
Read: docs/tasks/{ID}.md (full handoff)
Read: only files listed in Scope IN
Spec: section IDs from handoff only — do NOT load docs/SPEC.md wholesale
Verify: npm run test && npm run typecheck
Return: files changed, acceptance checklist, blockers
Do NOT: update ROADMAP/TASKS, pick next task, expand scope
```

## Milestone order

```
I0 (process) → S0 ∥ M0 → M1 (after S0-05 + M0 gate) → M2 → M3
```

S0 spike runs in parallel with M0 (SPEC §0.2). M1 blocked until S0-05 decision doc exists.

## Key invariants

1. Claude-specific code only in `src/adapters/claude/`
2. M0–M2 are read-only — no writes to scanned project's `.claude/**`
3. Ordinary scan must not run third-party code
4. Honest `unknown` beats confident wrong answers

## Fixture layout

Each fixture under `tests/fixtures/claude/<name>/`:

```
project/       # file tree
env.json       # environment variables
version.txt    # Claude Code version
contexts.json  # execution contexts
expected.json  # golden expectations
```

Optional entries a fixture may add: `cwd.txt` (scan starts at that path inside
`project/`, exercising the upward walk), `add-dirs.json`, `plugin-roots.json`
and `managed-bundle/`.

### Fixture isolation

A golden must depend on the fixture, not on the machine (SPEC §13 invariant 2).
Two ambient inputs would otherwise reach it, and the test run neutralizes both:

- `$HOME` points at an empty temp directory, so `~/.claude/settings.json` and
  `~/.claude.json` cannot reach a golden (H1-22).
- Each fixture `project/` is given a `.git` directory for the duration of the
  run (`tests/fixtures/global-setup.ts`), so the upward scope walk stops at the
  fixture project instead of climbing into the Capsight checkout and reading
  *this* repository's `.claude/agents/` (D1-00).

The repo-root marker is created and removed by the run, not committed: git
refuses to index a path named `.git`. It is created in place rather than in a
copy under `os.tmpdir()`, because instruction capabilities are ordered by
`sha256(absolute path)` — relocating a fixture would reorder `capabilities` in
the normalized output. For the same reason, **never record a golden from a copy
of a fixture**; record it from the corpus directory.

`npm run test` therefore leaves `tests/fixtures/*/*/project/.git/` behind only
if a run is killed mid-way; the path is gitignored, and the next run reuses and
keeps it rather than deleting a marker another run may still need.
