# D2-05: UI — evidence line in the Why panel

## Goal

Each claim in the Why panel shows its fact confidence tier and matrix reference so doc-only claims read visibly weaker than fixture-backed ones.

## Spec refs

- SPEC §8.1 (confidence tiers)
- SPEC §7.5 (Why panel)
- SPEC §13 invariant 3 (source, reason, enforcement)
- SPEC §13 invariant 13 (no coverage metric in user UI)

## Scope IN

- `src/ui/components/WhyPanel.tsx`
- `src/ui/styles.css`
- `tests/ui/why-panel-evidence.test.ts` (new)

## Scope OUT

- Coverage report UI (forbidden by inv 13)
- New resolver/matrix logic
- Changes to explain API shape beyond displaying existing fields

## Design decisions

**Per-claim, not per-project.** Show tier for each reason's `matrixRef` / cited fact — not the §11.4 suite aggregate.

**Tier labels:** `fixture`, `doc`, `ext`, `spike`, `unknown` — match registry confidence, visually distinct (fixture strongest).

**Reuse resolver data.** If explain payload lacks tier, derive from matrix lookup client-side only if API already exposes enough; do not invent tiers.

## Acceptance

- [ ] Each reason chain entry with a matrix ref shows confidence tier
- [ ] Fixture-backed tier visually distinct from documentation-only
- [ ] No §11.4 coverage percentage or suite metric anywhere in UI
- [ ] Existing Why panel behaviour (sources, reasons, enforcement) unchanged

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)
