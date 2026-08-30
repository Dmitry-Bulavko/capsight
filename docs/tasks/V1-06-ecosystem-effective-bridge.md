# V1-06: Ecosystem → effective bridge

## Goal

Let a declared resource on the Ecosystem canvas open its effective resolution, connecting the two halves SPEC §7.4 names.

## Spec refs

- SPEC §7.4 (declared and effective are two views of one project)
- SPEC §4.1 (effective configuration is a function of context — never shown without one)
- SPEC §7.10

## Current state

After EC, the dashboard holds two products that do not meet. Ecosystem shows the declared inventory across every detected platform with no context. Context, Capabilities, Graph and Editor show the effective layer for one platform, one agent, one context. Nothing crosses.

## Scope IN

- `src/ui/components/EcosystemView.tsx` / `ResourceDetailPanel.tsx` — bridge action
- `src/ui/App.tsx` — platform / agent / tab transition
- `src/ui/styles.css`
- `tests/ui/`

## Scope OUT

- Resolving non-Claude platforms — the resolver is Claude-only and must stay so (invariant 1)
- Merging the two canvases
- New API

## Design decisions

**The transition is explicit and reversible.** Moving from declared to effective changes the selected platform, agent and possibly the scanned project. Say so before doing it, and make the way back obvious. A silent switch would make the user read an effective answer as if it were the declared one.

**Context comes with the destination.** The effective side always carries a context; arriving there lands on the default preset (`background-subagent`) with its existing caption explaining why (T6, §4.3). Never render an effective answer without its context (§4.1).

**Not everything bridges.** A Cursor or Codex resource has no effective resolution in this product. The action is absent or disabled with a caption naming the reason — never a dead click, never an empty panel.

**Agent resources first.** An agent resource maps cleanly onto an effective resolution. Skills, MCP servers and instruction sources map onto capabilities within an agent's resolution; if a mapping is ambiguous, offer the agent choice rather than guessing.

## Acceptance

- [ ] A Claude agent resource on the canvas opens its effective resolution
- [ ] The platform / agent / context switch is stated before it happens, and returning to the canvas restores the previous view
- [ ] The destination always shows the context it resolved under
- [ ] Non-Claude resources present a disabled action with a reason, not a broken one
- [ ] Resources with no unambiguous effective counterpart ask rather than guess

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

EC-04's captions — `Declared inventory — all platforms` vs `Effective resolution — one context` — are the vocabulary this bridge must keep using. Do not introduce a third phrasing.
