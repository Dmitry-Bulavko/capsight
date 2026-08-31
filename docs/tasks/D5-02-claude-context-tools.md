# D5-02: Claude context/tools promotion

## Goal

Promote context and tools facts from documentation-only to fixture-verified where D5-01 marks `promotion-owed`.

## Spec refs

- SPEC §3.3 (T1, T2, T3, T5)
- SPEC §3.4 (F11)
- H1-28, §11.1

## Scope IN

- `src/adapters/claude/version/matrix.ts` — `context.filter1`, `context.filter2`, `context.fork`, `context.foregroundBackground`, `agent.toolAliases`
- `tests/fixtures/claude/tools-filters/`, `background/`, `fork/`
- `tests/adapters/claude/version/matrix.test.ts` or fixture deletion tests

## Scope OUT

- Permissions/trust (D5-03)
- Permission engine (§2.3)
- Cursor/Codex

## Expected candidates (confirm via D5-01)

| Fact | Entry | Fixture |
|------|-------|---------|
| T1 | context.filter1 | tools-filters |
| T2 | context.filter2 | background |
| T3 | context.fork | fork |
| T5 | context.foregroundBackground | tools-filters |
| F11 | agent.toolAliases | tools-filters |

## Acceptance

- [ ] Each promotion-owed fact in cluster either in `verifiedFacts` with deletion test OR refused in matrix notes
- [ ] No entry claims `verifiedFacts` without operative golden delta (H1-28)
- [ ] D4-06 gate unchanged
- [ ] `npm run test` and `npm run typecheck` pass

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)
