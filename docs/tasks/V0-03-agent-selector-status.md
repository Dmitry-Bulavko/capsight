# V0-03: The agent dropdown lost its status badge

## Goal

The header agent selector shows each agent's status again, in markup that is valid inside `<option>`.

## Spec refs

- SPEC §12.4 M0 (`GET /api/agents`)
- Agent status axis (active / invalid / ambiguous / shadowed / unknown)

## Scope IN

- `src/ui/components/AgentSelector.tsx`
- `src/ui/styles.css` (selector rules)
- A UI test for the option labels

## Scope OUT

- `AgentList` and the capability badges — those keep their `status-badge` markup and are unaffected
- Re-introducing `appearance: base-select` / `<selectedcontent>`

## Finding

The selector used to render `<span class="agent-option-name">` plus a `<span class="status-badge">` inside each `<option>`, with a `<button><selectedcontent /></button>` for the customizable-select preview. That markup is invalid — `<option>` takes text — and produced React DOM-nesting errors in the console; `selectedcontent` needed a hand-written JSX declaration to typecheck at all.

The fix landed incidentally in V0-01 (PR #2, commit `ae28bd8`): options are plain text now, `jsx-custom-elements.d.ts` is gone, and the console is clean. The correctness part is settled. What it also did, unannounced, is drop the coloured status badge: the compact selector shows the bare name, the wide one `name — Active`. No test covers either shape.

## Acceptance

- [ ] Status is visible in the dropdown again — as text or as a native-select-compatible affordance, not nested elements inside `<option>`
- [ ] No React DOM-nesting or hydration warnings in the console
- [ ] Compact and non-compact variants each have a stated, tested label shape
- [ ] `.agent-select` CSS matches whatever the markup ends up being — no rules left for elements that no longer exist

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Raised in review of V0-01 (PR #2): the fix was correct but out of that task's scope and undocumented, so the behaviour change is recorded here rather than lost in a folder-picker commit.
