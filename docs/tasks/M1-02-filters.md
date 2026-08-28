# M1-02: Core filter engine

## Goal

Platform-agnostic filter application: context filters T1/T2, fork skip, depth limit for Agent tool.

## Spec refs

- SPEC §4.4 rules 1-4
- T1, T2, T3, N2

## Scope IN

- `src/core/resolver/filters.ts` — applyContextFilters(tools, context) → filtered + reasons
- `src/core/resolver/builtin-tools.ts` — known builtin tool name lists
- `tests/core/resolver/filters.test.ts`

## Acceptance

- [ ] Filter 1 removes tools per T1 (respect plan mode ExitPlanMode exception)
- [ ] Filter 2 applies when isBackground
- [ ] Fork returns empty delta with reason context-filter (parent pool passed separately)
- [ ] depth >= maxDepth removes Agent with reason depth-limit
- [ ] Deterministic ordering
- [ ] Tests cover foreground/background/fork/explore/depth

## Done checklist

- [ ] npm run test && npm run typecheck
