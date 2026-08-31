# D5-03: Claude permissions/trust promotion

## Goal

Promote permissions and trust facts from documentation-only to fixture-verified where D5-01 marks `promotion-owed`.

## Spec refs

- SPEC §3.4 (P1, P5)
- SPEC §3.7 (R1, R2, R5, R6)
- H1-28

## Scope IN

- `src/adapters/claude/version/matrix.ts` — permission-inheritance, trust entries
- `tests/fixtures/claude/permission-inheritance/`, `trust-inline-mcp/`, `add-dir/`, `nested-project/`
- Deletion tests

## Scope OUT

- Context/tools (D5-02)
- Skills (D5-04)

## Expected candidates (confirm via D5-01)

| Fact | Entry | Fixture |
|------|-------|---------|
| P1 | permission P1 entry | permission-inheritance |
| P5 | permission P5 entry | permission-inheritance |
| R1 | trust.inlineMcp | trust-inline-mcp |
| R2 | trust.parentFolder | nested-project |
| R5 | trust.frontmatterHooks | trust-inline-mcp (may already be fixture entry-level) |
| R6 | trust.addDirSeparate | add-dir (may already be fixture entry-level) |

## Acceptance

- [ ] Each promotion-owed fact promoted or refused in writing
- [ ] Entries with `confidence: "fixture"` and empty `verifiedFacts` either backfilled or notes explain partial pin
- [ ] D4-06 unchanged
- [ ] `npm run test` and `npm run typecheck` pass

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)
