# EC-08: Mixed-project golden fixture

## Goal

Add a fixture holding Claude, Cursor and Codex artifacts plus a local override in one tree, and gate the ecosystem inventory on it the way every other surface is gated.

## Spec refs

- SPEC §11.1 (fixture corpus), §11.2 (fixture contract), §11.3 (correctness gate)
- SPEC §13 invariant 2 (fixtures must not read the developer's own home)

## Scope IN

- `tests/fixtures/ecosystem/mixed/` — `project/`, `env.json`, `version.txt`, `contexts.json`, `expected.json`
- `tests/fixtures/run-ecosystem-golden.test.ts`
- `tests/fixtures/correctness-gate.test.ts` — include the ecosystem runner
- `docs/ROADMAP.md` — corpus count

## Scope OUT

- New product behaviour

## Design decisions

**The tree must exercise every claim the screen makes:** `.claude/agents/` + `.claude/skills/`, `.cursor/rules/*.mdc` + `.cursor/skills/`, `AGENTS.md` at root (shared: Cursor **and** Codex), `.agents/skills/`, a `.codex/config.toml`, an MCP config with an `env` block whose value must never surface, and one skill name present both in the repository and in a `local`-scope location.

**Hermetic, per H1-22.** `env.json` pins every home and config path; the run must resolve identically on any machine. No test may read the developer's real `~/.claude/`, `~/.cursor/` or `~/.codex/`.

**`expected.json` pins the unknowns too.** Compat verdicts that resolve `unknown` are recorded as `unknown` — a later change that silently promotes one to `supported` must fail the gate. This is the H1-28 lesson: a corpus where the confident answers are pinned and the unknowns are not will drift toward confidence.

## Acceptance

- [x] Fixture tree contains all artifact classes listed above
- [x] `expected.json` pins detection (Cursor and Codex both detected via `AGENTS.md`), the inventory, the overlap relation and every compat verdict including `unknown` ones
- [x] Golden runner passes and fails loudly on mismatch — no fail-open (H1-07)
- [x] Run is hermetic: passes with the developer's real home directories absent
- [x] Test asserts the MCP `env` value never appears in the inventory output
- [x] Correctness gate includes the ecosystem runner; corpus count updated in ROADMAP

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)

## Notes

Without this fixture the phase's cross-platform claims rest on hand-testing against one machine's projects — the exact gap H1 spent twenty-eight tasks closing.
