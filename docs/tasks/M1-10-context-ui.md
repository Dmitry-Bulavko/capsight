# M1-10: Context selector UI

## Goal

UI preset selector; changing preset refetches effective config for selected agent.

## Spec refs

- SPEC §4.3 — default background-subagent with label

## Scope IN

- `src/ui/components/ContextSelector.tsx`
- Update `src/ui/App.tsx`, `src/ui/api.ts`

## Acceptance

- [ ] Dropdown/radio for all 7 presets
- [ ] Default: background-subagent with note why (T6)
- [ ] Selecting agent + preset loads GET /api/agents/:id/effective
- [ ] Shows unknownRate from effective config

## Done checklist

- [ ] npm run test && npm run typecheck
