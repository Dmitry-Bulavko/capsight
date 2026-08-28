# M2-06: Context-aware graph

## Goal

Inspection graph with React Flow; edges recompute on context change.

## Spec refs

- SPEC §7.10

## Scope IN

- Install `@xyflow/react` (react flow)
- `src/core/graph/build-graph.ts` — nodes/edges from snapshot+effective
- `src/server/routes/graph.ts` — GET /api/graph?context=
- `src/ui/components/GraphView.tsx`
- Wire in App

## Acceptance

- [ ] Nodes: Agent, Tool, MCP Server, Skill, Instruction
- [ ] Edges context-aware from effective config
- [ ] Context change refetches graph
- [ ] Read-only inspection only
- [ ] npm run test && typecheck

## Done checklist

- [ ] npm run test && npm run typecheck
