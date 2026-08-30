# V1-05: Graph → Why bridge

## Goal

Make a graph node click select its capability and open the Why panel, so the graph becomes a way into the explanation instead of a separate read.

## Spec refs

- SPEC §7.5 (Why panel)
- SPEC §7.10 (graph is inspection only; edges are not workflow)
- SPEC §2.3 (no drag-and-drop graph editing)

## Current state

`GraphView.tsx` contains no click, select or node-interaction handler. The graph is built from the same resolved data the Capabilities tab uses, but the two do not talk.

## Scope IN

- `src/ui/components/GraphView.tsx`
- `src/ui/App.tsx` — shared selected-capability state
- `src/ui/styles.css`
- `tests/ui/`

## Scope OUT

- New API or fetch path — `fetchExplain` already exists and is already wired for the Capabilities tab
- Node dragging, connecting, or persisted positions (§2.3)
- Edge semantics changes

## Design decisions

**One selection, two views.** Selected capability lives in `App.tsx` and is shared, so selecting in the graph and selecting in the list are the same act. Selection must survive a tab switch.

**Not every node is a capability.** Agent, MCP-server and instruction-source nodes do not map to a capability id one-to-one. Decide per node kind: either it selects a capability, or it is explicitly non-selectable — never a click that appears to do nothing.

**Read-only stays read-only.** Selection is not editing. `nodesDraggable={false}` and `nodesConnectable={false}` remain.

## Acceptance

- [ ] Clicking a capability-bearing node selects that capability and opens Why
- [ ] The same capability selected from the list and from the graph produces the same panel
- [ ] Selection persists across a tab switch between Graph and Capabilities
- [ ] Non-selectable node kinds are visibly non-interactive rather than inert
- [ ] Nodes still cannot be dragged or connected; no layout state is written

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Keep `graph-layout.ts` pure — selection is rendering state, not layout.
