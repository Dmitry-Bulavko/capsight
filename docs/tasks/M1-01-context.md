# M1-01: ExecutionContext presets + builder

## Goal

Build ExecutionContext from preset + optional overrides per SPEC §4.2–§4.3.

## Spec refs

- SPEC §4.2 ExecutionContext interface (already in core/model)
- SPEC §4.3 preset table

## Scope IN

- `src/core/resolver/context.ts` — `buildExecutionContext(preset, overrides?)`
- `src/core/resolver/index.ts`
- `tests/core/resolver/context.test.ts`

## Scope OUT

- UI selector (M1-10)
- Full resolver (M1-02+)

## Acceptance

- [ ] All 7 presets produce correct flag combinations per §4.3 table
- [ ] Overrides: depth, maxDepth, parentPermissionMode
- [ ] Default maxDepth from env CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH or 3
- [ ] Tests for each preset
- [ ] npm run test && npm run typecheck pass

## Done checklist

- [ ] npm run test
- [ ] npm run typecheck
