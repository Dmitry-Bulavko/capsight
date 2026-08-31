# S9P-03: ObservedCapability core model

## Goal

Add core types and storage for invocation-only observed capabilities (not wired to scan).

## Spec refs

- SPEC §9.3 (`ObservedCapability` interface)

## Scope IN

- `src/core/observed/` — types, normalization, evidenceKind rules
- Tests enforcing §9.3 invariants (absence never → denied)

## Scope OUT

- Scan integration
- UI (S9P-06)
- CLI observe command body (S9P-04)

## Acceptance

- [ ] `ObservedCapability` type matches SPEC §9.3 fields
- [ ] Normalizer rejects invalid absence→denied promotion
- [ ] Unit tests cover available / not-observed / denied (denied requires permission-denied kind)
- [ ] `npm run test` and `npm run typecheck` pass

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] TASKS.md updated by orchestrator (not implementer)
