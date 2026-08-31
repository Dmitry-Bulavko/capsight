# SS-01: S6 — Bash(cmd:*) prefix rule shape

## Goal

Evaluate `Bash(...)` permission rules for prefix/`:*` shape per S6 — without building a permission engine (§2.3).

## Spec refs

- SPEC §3.5 S6
- SPEC §2.3 (no per-invocation approval)
- D1-03 question 2: does the rule shrink/shape the reported capability; is `:*` only valid at end?

## Scope IN

- `src/adapters/claude/resolution/settings-permissions.ts`
- `src/adapters/claude/version/matrix.ts` — `settings.bashPrefixRules` (remove `noFixturePossible`, add fixture when pinned)
- `tests/fixtures/claude/settings-permissions/` — extend so at least one `Bash(...)` rule reaches S6 (not inert behind bare `Bash` deny)
- `tests/adapters/claude/resolution/settings-permissions.test.ts`

## Scope OUT

- S7 path globs (SS-02)
- S11 (SS-03)
- Deciding whether a concrete command line would be approved at runtime

## Design decisions

**In scope:** Report rule validity/shape — e.g. mid-pattern `:*` vs trailing `:*`, malformed prefix — as capability status/reason gated on `settings.bashPrefixRules`.

**Out of scope:** Runtime command matching ("would `npm test` match?").

**Fixture:** Current corpus rules are inert behind project `deny: ["Bash"]`. Add a layer/agent context where `Bash(npm run test:*)` is the operative rule without bare Bash deny blocking it, or add a dedicated sub-agent in the fixture.

## Acceptance

- [ ] `Bash(...)` rules route through S6 matrix entry with non-unknown status when shape is decidable
- [ ] Mid-pattern `:*` and trailing `:*` handled per S6 (not invented S8-style "grants nothing" unless S6 says invalid)
- [ ] Fixture makes S6 the operative cause of at least one confident golden value; deletion test or documented H1-28 path
- [ ] `noFixturePossible` removed from `settings.bashPrefixRules` when fixture pins
- [ ] `npm run test` and `npm run typecheck` pass

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)
