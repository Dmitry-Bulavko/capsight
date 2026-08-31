# S9P-02: Invocation-only UX contract

## Goal

Product-commit to invocation-only observed layer (§9.3 one-sided semantics) enabling S9P-03+ without structural pool API.

## Spec refs

- SPEC §9.3
- S9-DECISION.md criterion 1 (invocation-only branch)

## Scope IN

- `docs/S9P-UX-CONTRACT.md` — one-sided semantics, UI copy rules, what is NOT claimed (`not-observed` ≠ denied)
- Update `docs/S9-DECISION.md` — addendum: partial go authorized
- `docs/SPEC.md` — only if cross-link needed (minimal)

## Scope OUT

- Product code / UI implementation (S9P-06)
- Structural `resolved != observed` gate (S9-04 remains cancelled)

## Acceptance

- [ ] Contract states: available = invoked; not-observed ≠ denied; denied requires explicit denial event
- [ ] PermissionDenied limits documented (auto-mode only)
- [ ] S9-DECISION addendum links contract and authorizes S9P-03+
- [ ] `npm run test` and `npm run typecheck` pass

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] TASKS.md updated by orchestrator (not implementer)
