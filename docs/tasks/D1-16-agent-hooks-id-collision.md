# D1-16: `agent-hooks` capability id collision

## Goal

Fix normalization where an agent's hooks capability and an instruction source collapse to the same golden id, losing one capability in the recorded output.

## Spec refs

- SPEC §11.2, §13 invariant 2 (hermetic goldens)
- D1-06 review finding

## Scope IN

- `tests/fixtures/golden-normalize.ts` — `normalizeCapabilityId` for hooks vs instructions
- `src/adapters/claude/resolution/resolver.ts` — `agent-hooks` capability id if source of collision
- Relevant golden(s) if ids change — re-record as pure id fix, behaviour unchanged
- Unit test asserting hooks and instruction capabilities remain distinct in normalized output

## Scope OUT

- Cursor/Codex adapters (unless same pattern exists and fix is shared in golden-normalize only)
- Changing hooks trust semantics

## Design decisions

**Problem:** `agent-hooks` uses fixed id `agent-hooks` in resolver, but golden-normalize may rewrite instruction capabilities to `instruction:<path>`. When hooks and an instruction share normalization logic, two distinct capabilities can collapse to one id in goldens.

**Fix:** Ensure hooks capabilities normalize to a stable, unique id (e.g. `capability:agent-hooks` or `hooks:<agent-relative-path>`) that cannot collide with `instruction:<path>`. Update normalize logic consistently.

**Verify:** Agent with both hooks in frontmatter and instruction sources — normalized golden lists both capabilities with distinct ids.

## Acceptance

- [ ] Two capabilities from one agent file (hooks + instruction) cannot collapse to one normalized id
- [ ] Existing trust/hooks goldens pass after re-record (permute-only if ids change)
- [ ] Unit or golden test pins the collision case
- [ ] Deletion test: if matrix-gated, unfounding rule changes golden; otherwise document as normalize-only fix

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Reported at `golden-normalize.ts:298-303`, `resolver.ts:505`.
