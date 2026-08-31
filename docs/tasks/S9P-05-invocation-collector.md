# S9P-05: Invocation-side observation collector

## Goal

Parse PreToolUse / PermissionDenied hook event shapes into ObservedCapability records (invocation-only).

## Spec refs

- SPEC §9.3
- S9P-PROBE-FINDINGS hook sections

## Scope IN

- `src/adapters/claude/probing/invocation-collector.ts`
- Hook event JSON schema + tests with recorded samples
- `docs/S9P-PROBE-FINDINGS.md` hook payload section if needed

## Scope OUT

- Installing hooks on user projects automatically
- Structural pool comparison

## Acceptance

- [ ] PreToolUse event → `evidenceKind: tool-invoked`, `observedStatus: available`
- [ ] PermissionDenied event → `evidenceKind: permission-denied`, `observedStatus: denied`
- [ ] Silence / absence produces no denied records
- [ ] `npm run test` and `npm run typecheck` pass

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] TASKS.md updated by orchestrator (not implementer)
