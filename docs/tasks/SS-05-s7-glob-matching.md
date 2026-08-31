# SS-05: S7 — path glob matching depth

## Goal

Evaluate whether S7 **path glob matching** (beyond `/` vs `//` anchoring pinned in SS-02) can be reported without per-path approval (§2.3).

## Spec refs

- SPEC §3.5 S7
- SPEC §2.3
- SS-02 outcome: project-root `/` and filesystem-root `//` anchoring pinned; concrete path matching is not

## Scope IN

- `src/adapters/claude/resolution/settings-permissions.ts`
- `src/adapters/claude/version/matrix.ts` — `settings.pathRules`
- `tests/fixtures/claude/settings-permissions/`
- `tests/adapters/claude/resolution/settings-permissions.test.ts`

## Scope OUT

- S6 prefix matching (SS-04)
- S11 relative additionalDirectories
- Stating whether a concrete file path would match a glob at runtime
- UI

## Design decisions

**In scope if documentable:** Report glob semantics that do not require naming a specific path outcome — e.g. `**` segment behavior, leading `./`, or match boundaries — as capability metadata gated on S7.

**Out of scope:** "Would `/src/foo.ts` match this rule?" verdicts.

**If not documentable:** Written refusal in matrix notes; keep honest `unknown` on path-specific channels.

## Acceptance

- [x] S7 glob-matching question answered — written refusal in matrix (`noFixturePossible (matching half)`)
- [x] H1-28 — SS-02 anchoring pins unchanged; matching half not promoted
- [x] D4-06 gate unchanged
- [x] `npm run test` and `npm run typecheck` pass

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)
