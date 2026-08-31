# F0-03: Warning↔capability link without UI heuristics

## Goal

Stop inferring which capability a warning belongs to via path substring heuristics in the UI.

## Spec refs

- SPEC §13 invariant 3
- SPEC §7.6

## Scope IN

- Preferred: `src/adapters/claude/resolution/` — emit `relatedCapabilityIds: string[]` on `Warning` when resolver knows the link
- `src/core/model/index.ts` — optional field on `Warning`
- `src/ui/components/WarningsPanel.tsx` — use structured ids for badge; remove `warningRelatesToCapability` heuristics OR remove badge if no ids
- `tests/ui/warnings-panel.test.ts`
- Golden updates only if new field appears in normalized warnings

## Scope OUT

- Cursor/Codex resolver (Claude first; extend only if same pattern exists)

## Design decisions

If resolver cannot reliably attach capability ids for a warning class, **remove the capability-row badge** for that class rather than guess. Badge only when `relatedCapabilityIds` is non-empty.

## Acceptance

- [x] No `endsWith` / `includes("tools")` path matching in WarningsPanel for capability association
- [x] Bash guardrail and permission warnings link to correct capabilities when ids provided
- [x] Wrong-capability badge cannot occur on `disallowedTools` vs `tools` ambiguity
- [x] `npm run test` and `npm run typecheck` pass

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)
