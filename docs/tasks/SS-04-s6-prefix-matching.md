# SS-04: S6 — command prefix matching depth

## Goal

Evaluate whether S6 **prefix matching** (beyond `:*` shape pinned in SS-01) can be reported without building a permission engine (§2.3).

## Spec refs

- SPEC §3.5 S6
- SPEC §2.3 (no per-invocation approval)
- SS-01 outcome: trailing vs mid-pattern `:*` shape is pinned; notes say concrete command matching is not

## Scope IN

- `src/adapters/claude/resolution/settings-permissions.ts`
- `src/adapters/claude/version/matrix.ts` — `settings.bashPrefixRules` (extend notes, `verifiedFacts`, or split entry)
- `tests/fixtures/claude/settings-permissions/` — extend only if a deletion test can pin prefix matching
- `tests/adapters/claude/resolution/settings-permissions.test.ts`

## Scope OUT

- S7 glob matching (SS-05)
- Stating whether a concrete command line (e.g. `npm test`) would be approved at runtime
- Cursor/Codex matrices
- UI

## Design decisions

**In scope if documentable:** Report how prefix patterns relate to rule text — e.g. whether `Bash(npm run test:*)` matches only commands sharing that prefix — as capability metadata gated on S6, without simulating full Bash approval.

**Out of scope:** Runtime invocation verdicts ("would this command be allowed?").

**If not documentable:** Extend matrix notes with written refusal; optionally add `noFixturePossible` sub-clause documenting why prefix matching stays unknown. Do not invent confident `available`/`denied` from prefix alone.

## Acceptance

- [x] S6 prefix-matching question answered — written refusal in matrix (matching half `noFixturePossible`)
- [x] H1-28 — SS-01 shape pins unchanged; matching half not promoted
- [x] D4-06 gate unchanged
- [x] `npm run test` and `npm run typecheck` pass

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)
