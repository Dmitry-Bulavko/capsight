# V1-04: Agent declared configuration block

## Goal

Show an agent's frontmatter as-is in the Agents tab, so the declared layer is readable without opening the file.

## Spec refs

- SPEC §7.1 (discovery, read-only; declared frontmatter as-is)
- SPEC §10 Acceptance M0 (agents listed with source; invalid with reason; A4 ambiguous with no winner)
- SPEC §5 (domain model — `Agent.configuration`)

## Current state

`AgentList.tsx` imports `Agent` but renders meta only: name, scope, path, status. `Agent.configuration` — tools, disallowedTools, model, permissionMode, skills, hooks, mcpServers — is in the snapshot and never shown.

## Scope IN

- `src/ui/components/AgentList.tsx`
- `src/ui/styles.css`
- `tests/ui/`

## Scope OUT

- Effective values of any kind — this is the declared layer only; pairs are V1-02
- Editing (the Editor tab owns pending state)
- New API; `GET /api/agents` already returns the configuration

## Design decisions

**As-is means as-is.** Render declared values without interpretation. An empty `tools` and an absent `tools` mean different things (F2 vs. inherited pool) and must not render identically.

**Existing states survive.** `invalid` with its A7 reason, `shadowed`, and `ambiguous` with no winner (A4) keep their current presentation; the configuration block is added beside them, not instead. An `invalid` agent shows whatever parsed, marked as not in effect.

**Unknown fields are evidence.** If the snapshot preserves frontmatter keys the model does not recognise, show them as unrecognised rather than dropping them — silently discarding a key is how a user concludes it works.

**Secrets never widen.** Whatever redaction the discovery layer applied stays applied (invariant 10); the UI does not reach for raw file content.

## Acceptance

- [ ] Each agent shows its declared tools, disallowedTools, model, permissionMode and skills when present
- [ ] Absent and empty collections are distinguishable
- [ ] `invalid` / `shadowed` / `ambiguous` presentation is unchanged, and an invalid agent's block is marked not-in-effect
- [ ] Unrecognised frontmatter keys are visible as such
- [ ] No secret or raw MCP env reaches the panel

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

`ResourceDetailPanel.tsx` already solves the redacted-model-no-body problem for MCP and settings resources; follow its precedent instead of inventing a second rule.
