# S0-05: Observed layer decision

## Goal

Decision document: include observed layer in v0.1 or fallback per SPEC §9.5.

## Spec refs

- SPEC §9.5 fallback
- S0-01 through S0-04 findings in docs/tasks/

## Scope IN

- `docs/S0-DECISION.md`
- Update ROADMAP observed-layer field (orchestrator will update ROADMAP after verify)

## Acceptance

- [ ] Decision: observed-layer yes | no
- [ ] Rationale citing S0-01..04 findings
- [ ] If no: list exclusions (ObservedCapability, runtime gate items)
- [ ] If no: max confidence becomes fixture per §9.5

## Done checklist

- [ ] npm run test && npm run typecheck
