# UI-A-04: Graph per-agent scope

## Goal

Scope the inspection graph to the selected agent in the Agents workspace.

## Spec refs

- SPEC §7.10 (context-aware inspection graph)

## Scope IN

- `src/server/routes/graph.ts` — optional `agent` query param
- `src/core/graph/build-graph.ts` — `filterGraphToAgent(graph, agentId)` helper
- `src/ui/api.ts` — `fetchGraph(context, agentId?)`
- `src/ui/components/GraphView.tsx` — require `agentId` prop
- `tests/server/` or `tests/core/graph/` — agent filter tests

## Scope OUT

- Multi-agent graph as default in Agents workspace (selected agent only per design)
- Resolver changes
- Top nav changes (UI-A-05)

## Design decisions

**API:** `GET /api/graph?context=&agent=<id>`. When `agent` is set, resolve only that agent; filter graph to nodes/edges reachable from `agent:{id}`.

**Spawn edges:** `agent-agent` edges from the selected agent to other agents may show target agent nodes as leaves without expanding their full subtrees.

**Missing/invalid agent:** 400 with clear error; UI shows empty state.

**Backward compatibility:** omitting `agent` returns full multi-agent graph (CLI/tests unchanged).

## Acceptance

- [x] `GET /api/graph?agent=<id>` returns only the selected agent's subgraph
- [x] `filterGraphToAgent` has unit tests for reachability
- [x] `GraphView` passes `agentId` and does not fetch without a selected agent
- [x] Graph sub-tab in Agents workspace shows per-agent graph
- [x] `npm run test` and `npm run typecheck` pass

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)

## Notes

Branch: `feat/ui-a-agents-workspace`. Claude-only graph (501) unchanged for other platforms.
