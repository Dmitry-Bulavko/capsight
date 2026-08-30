# V1-03: Capability list depth — kind and enforcement

## Goal

Give every capability row its enforcement and kind, so that a claim in the list carries the same three parts the Why panel gives it.

## Spec refs

- SPEC §13 invariant 3 (every assertion has source, reason and enforcement)
- SPEC §6 (enforcement classification: `enforced` / `advisory` / `unknown`)
- SPEC §7.3, §2.4

## Current state

`EffectiveCapabilities.tsx` renders `capabilityId` and `status` only. `enforcement` reaches the screen exclusively through `WhyPanel`, after a click. A capability denied by an `enforced` rule and one denied with `enforcement: "unknown"` are therefore identical at a glance — which is precisely the distinction §14 says the product exists to preserve.

## Scope IN

- `src/ui/components/EffectiveCapabilities.tsx`
- `src/ui/styles.css`
- `tests/ui/`

## Scope OUT

- Why panel changes (it already satisfies invariant 3)
- New resolution or classification logic
- Warnings (V1-01)

## Design decisions

**Enforcement is not decoration.** `unknown` must be visually distinct from `enforced` at list density — not a subtle tint. `advisory` reads as "configuration guardrail", never as a boundary (§2.4).

**Kind earns its place through filtering.** `ResolvedCapability` carries the kind (tool, skill, instruction, permission, MCP). Grouping or a filter — pick one and justify it in the handoff notes; do not ship both.

**Sort order stays deterministic.** The current sort is by `capabilityId`; grouping must not make ordering depend on anything ambient (invariant 2).

## Acceptance

- [ ] Every row shows its enforcement
- [ ] `unknown` enforcement is unmistakable at list density without hovering or clicking
- [ ] Capability kind is visible, and filtering or grouping by kind works
- [ ] Ordering remains deterministic for a given input
- [ ] Clicking a row still opens the Why panel exactly as before

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Reuse `ENFORCEMENT_LABELS` from `WhyPanel.tsx` rather than defining a second label map; two label sets will drift.
