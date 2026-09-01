# UI-A-06: Ecosystem bridge → Agents workspace

## Goal

Update the Ecosystem → effective bridge to land in the Agents workspace instead of the removed Capabilities top-level tab.

## Spec refs

- SPEC §7.4 (declared and effective are two views of one project)
- SPEC §4.1 (effective always shown with context)
- SPEC §7.10

## Scope IN

- `src/ui/App.tsx` — `handleBridgeToEffective`: `setActiveTab("agents")` + `setAgentInspectorTab("capabilities")`
- `src/ui/components/AgentsWorkspace.tsx` — ecosystem return banner (move from old capabilities tab)
- `tests/ui/ecosystem-effective-bridge.test.ts` — update expectations

## Scope OUT

- Bridge evaluation logic in `ResourceDetailPanel` (unchanged)
- Resolver / graph API

## Design decisions

**Same vocabulary:** keep captions "Declared inventory — all platforms" vs "Effective resolution — one context" (V1-06 / EC-04).

**Return flow:** "Back to Ecosystem canvas" restores resource selection on ecosystem tab.

**Capability pre-selection:** when bridge provides `capabilityId`, open Capabilities sub-tab with Why panel if applicable.

## Acceptance

- [x] Claude agent resource bridge opens Agents tab on Capabilities sub-view
- [x] Platform switch remains explicit before bridge (existing behavior)
- [x] Return banner works from Agents workspace
- [x] `tests/ui/ecosystem-effective-bridge.test.ts` passes
- [x] Non-Claude resources still disabled with reason

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)

## Notes

Branch: `feat/ui-a-agents-workspace`. Extends V1-06 handoff.
