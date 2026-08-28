# M1-07: Environment normalization

## Goal

Build PlatformEnvironment from process env + settings env keys (names only).

## Spec refs

- SPEC §3.11, §5 PlatformEnvironment

## Scope IN

- `src/adapters/claude/environment/index.ts`
- `tests/adapters/claude/environment/env.test.ts`

## Acceptance

- [ ] Reads known CLAUDE_* vars from process.env — keys + normalized effect only, NO values
- [ ] Merges settings.env keys from settings layers (keys only)
- [ ] Tests verify no secret values in output

## Done checklist

- [ ] npm run test && npm run typecheck
