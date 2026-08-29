# EC-04: Ecosystem canvas replaces the Overview tab

## Goal

Replace the Overview tab with a reactflow canvas of thematic blocks — skills, MCP, agents, rules — showing the declared inventory across platforms, with scan controls and project summary moved to a side rail.

## Spec refs

- SPEC §7.4 (declared vs effective), §7.10 (graph is inspection, never workflow)
- SPEC §2.3 non-goals (no drag-and-drop graph editor)
- SPEC §12.4 M0 (scan surface preserved)

## Scope IN

- `src/ui/components/EcosystemView.tsx` — canvas
- `src/ui/components/EcosystemSideRail.tsx` — scan controls + counts, hosting existing `ScanPanel` and `ProjectSummary`
- `src/ui/ecosystem-layout.ts` — block layout (mirrors `graph-layout.ts` conventions)
- `src/ui/components/DashboardNav.tsx` — `overview` → `ecosystem`, label **Ecosystem**
- `src/ui/App.tsx` — tab wiring
- `src/ui/styles.css`
- `tests/ui/ecosystem-layout.test.ts`

## Scope OUT

- Compat badges and platform filter (EC-05)
- Detail panel (EC-06)
- Health readout (EC-07)
- Editing, dragging, or persisting node positions

## Design decisions

**Blocks, not a hairball.** Each kind is a reactflow parent node containing its resources. v1 draws exactly one edge kind: `overlaps` — the link between a `local` resource and the repository resource it collides with. Every other relation in the declared layer is containment, and containment is expressed by the block, not by a line. Agent→tool and agent→MCP edges stay on the Graph tab where a context makes them true.

**Two graph screens, named apart.** The tab description reads `Declared inventory — all platforms`; the Graph tab's reads `Effective resolution — one context`. Both captions ship in this task; without them the screens are indistinguishable to a first-time viewer.

**The Overview content survives.** `ScanPanel` and `ProjectSummary` are reused verbatim in the side rail, not rewritten. Nothing that Overview showed is lost.

**Read-only canvas.** Pan, zoom, select. `nodesDraggable={false}`, `nodesConnectable={false}`, no position persistence — §2.3.

**Scope badge on every node.** Rendered from `SourceInfo.scope`; `local` gets a distinct badge, and an overlapping pair is laid out adjacently so the local/repository relationship reads without clicking.

## Acceptance

- [ ] `ecosystem` is the first nav tab; `overview` no longer exists as a tab id
- [ ] Canvas renders four blocks (agents, skills, MCP, rules/instructions); an empty block renders as an explicit empty state, not as nothing
- [ ] Resources from all detected platforms appear in one canvas
- [ ] `local`-scope resources carry a visible **local** badge and sit adjacent to the repository resource they overlap
- [ ] The single `overlaps` edge kind is drawn; an unresolved collision (no winner) is visually distinct from a resolved one
- [ ] Nodes cannot be dragged or connected; no layout state is written anywhere
- [ ] Side rail hosts scan controls and counts; browse / rescan / path persistence behave exactly as before
- [ ] Both graph tabs carry their distinguishing captions

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Layout is pure and unit-tested the way `graph-layout.ts` is: given an inventory, positions and blocks are deterministic. Keep rendering out of it.
