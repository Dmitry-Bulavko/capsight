# M1-04: Permission mode declared vs effective

## Goal

Resolve declared permissionMode vs effective per P1, P2, P4.

## Spec refs

- P1, P2, P4, P5

## Scope IN

- `src/adapters/claude/resolution/permissions.ts` — resolvePermissionMode(agent, context, settings)
- `tests/adapters/claude/resolution/permissions.test.ts`

## Acceptance

- [ ] Returns { declared, effective, ineffective: boolean, reasons }
- [ ] Parent bypassPermissions/acceptEdits wins (P1)
- [ ] Parent auto ignores agent frontmatter (P2)
- [ ] disableBypassPermissionsMode blocks bypass (P4)
- [ ] Tests for each case

## Done checklist

- [ ] npm run test && npm run typecheck
