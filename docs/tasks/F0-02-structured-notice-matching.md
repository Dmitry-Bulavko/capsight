# F0-02: Fork + drift — match by type/matrixRef, not prose

## Goal

Remove remaining UI substring matching on resolver message text for fork notice and version drift warnings.

## Spec refs

- SPEC §7.4 (fork T3 — fact ref part of claim)
- SPEC §8.4 (version drift scoped downgrade)

## Scope IN

- `src/ui/components/DeclaredEffective.tsx` — `extractForkNotice`
- `src/ui/components/DriftBanner.tsx` — version warning collection
- `tests/ui/declared-effective.test.ts`
- `tests/ui/drift-banner.test.ts`

## Design decisions

**Fork (T3):** Match `reason.type === "context-filter"` AND `reason.matrixRef === "T3"`. Do not require `message.includes("Fork inherits")`. Render resolver `reason.message` verbatim plus fact ref — no UI-composed fork preamble.

**Drift:** Match version-scoped warnings by `warning.category === "version"` OR (`warning.enforcement === "unknown"` AND `warning.matrixRef` is set). Do not match `message.includes("Version matrix")`.

## Acceptance

- [x] Changing fork reason wording in `resolver.ts` without removing T3 matrixRef still shows fork notice
- [x] Fork notice absent when no T3 context-filter reason exists (no silent fallback without matrixRef)
- [x] Drift banner still collects version downgrades when matrix appends different downgrade text
- [x] Tests assert matching logic, not message literals from resolver
- [x] `npm run test` and `npm run typecheck` pass

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)
