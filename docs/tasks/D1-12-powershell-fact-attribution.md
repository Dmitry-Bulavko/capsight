# D1-12: PowerShell rules cite wrong fact (S6)

## Goal

Settings permission rules for `PowerShell(...)` must not attribute to `settings.bashPrefixRules` / fact S6 when S6 names only `Bash`.

## Spec refs

- S6, SPEC §8.2
- `settings-permissions.ts:153-156`

## Scope IN

- `src/adapters/claude/resolution/settings-permissions.ts`
- Related tests if present

## Scope OUT

- Implementing PowerShell prefix matching
- New fixtures unless needed to pin attribution text

## Design decisions

Either gate PowerShell rules under a honestly named fact/matrix entry, or emit reason text that S6 does not cover this tool — do not cite S6 for PowerShell.

## Acceptance

- [ ] PowerShell rule resolution does not cite S6 as authority unless S6 is extended in facts.ts (prefer honest disclaimer)
- [ ] Bash rules still cite S6/matrix as before
- [ ] No invented permission semantics — unknown stays unknown

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] TASKS.md updated by orchestrator

## Notes

Attribution-only fix from D1-03 neighbourhood.
