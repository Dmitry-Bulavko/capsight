# H1-12: Restore `src/core/` platform independence

## Goal

Claude-specific schemas, tool tables and environment variable names move into `src/adapters/claude/`; core keeps the flag-driven filter engine.

## Spec refs

- SPEC §12.2 (инвариант: `src/core/` не содержит ни одного пути `.claude/`, ни одного имени поля frontmatter, ни одной проверки версии)
- SPEC §13 invariant 1
- SPEC §4.2 (контекст как набор флагов)

## Scope IN

- src/core/model/index.ts
- src/core/resolver/builtin-tools.ts
- src/core/resolver/filters.ts
- src/core/resolver/context.ts
- src/core/graph/build-graph.ts (re-export at `:312`)
- src/adapters/claude/ (new home for the moved tables and types)

## Scope OUT

- Behaviour changes of any kind — this is a move, and the golden files must not shift
- Introducing a second platform adapter

## Findings being fixed

- `core/model/index.ts:71-85` is a literal transcription of the Claude agent frontmatter (`tools`, `disallowedTools`, `mcpServers`, `model`, `permissionMode`, `maxTurns`, `skills`, `hooks`, `memory`, `background`, `effort`, `isolation`, `initialPrompt`, `color`, `unknownFields`) — 14 of 14 prohibited field names. The file header at `:2-3` claims the opposite.
- `core/model/index.ts:47,55` hardcode `platform: "claude"`; `:40` enumerates Claude builtin agent kinds; `:17-23` enumerates Claude permission modes.
- `core/resolver/context.ts:65-74` reads `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` and hardcodes the default depth 3, duplicating `adapters/claude/environment/`.
- `core/resolver/builtin-tools.ts` is entirely Claude tool tables bound to facts T1/T2/F11, plus the `mcp__` prefix convention. The adapter imports them back out of core (`resolution/tools.ts:6`), which is the inversion.
- `core/resolver/filters.ts:92` branches on the literal `"ExitPlanMode"` inside core control flow.

## Acceptance

- [ ] `grep -nE '(disallowedTools|permissionMode|initialPrompt|mcpServers|CLAUDE_CODE_|"claude")' src/core/` returns nothing — asserted by a test
- [ ] Filter tables (T1 removals, T2 background allowlist, T4 teammate additions, agent-tool aliases, MCP prefix predicate) are supplied to the core engine as data by the Claude adapter
- [ ] `filters.ts` contains no tool-name string literal in a branch condition; the `ExitPlanMode` / `permissionMode: plan` carve-out is expressed via injected data or a flag
- [ ] Depth defaults and env interpretation live in `adapters/claude/environment/`
- [ ] All golden fixtures produce byte-identical output before and after the move
- [ ] Determinism preserved (invariant 2): identical input → identical output including order

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Lowest urgency of the H1 set — it is an architecture debt, not a wrong answer to a user. Schedule after H1-01..H1-04. The value is that adding a second platform later does not require touching the resolver.
