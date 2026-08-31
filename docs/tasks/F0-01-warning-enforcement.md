# F0-01: WarningItem renders enforcement

## Goal

Show `Warning.enforcement` on every warning row — same invariant 3 treatment V1-03 gave capabilities.

## Spec refs

- SPEC §7.6 (warnings visible and honest)
- SPEC §13 invariant 3 (enforcement on every assertion)

## Scope IN

- `src/ui/components/WarningsPanel.tsx` — `WarningItem` renders enforcement badge
- `src/ui/styles.css` — reuse enforcement badge styles from capabilities/Why panel
- `tests/ui/warnings-panel.test.ts`

## Scope OUT

- Resolver changes
- Capability badge heuristics (F0-03)

## Acceptance

- [x] Each warning with `enforcement` set shows the label (Enforced / Advisory / Unknown)
- [x] `unknown` enforcement is visually distinct from `enforced`
- [x] Warnings without enforcement (security findings) unchanged — no invented enforcement
- [x] `npm run test` and `npm run typecheck` pass

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)
