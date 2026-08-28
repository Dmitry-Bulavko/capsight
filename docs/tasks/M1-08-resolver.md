# M1-08: resolveEffective service

## Goal

Wire full resolution pipeline: snapshot + agentId + context → EffectiveConfiguration.

## Spec refs

- SPEC §4.4, §7.3, §6 enforcement classification

## Scope IN

- `src/adapters/claude/resolution/resolver.ts` — resolveEffectiveConfiguration(snapshot, agentId, context)
- `src/application/resolve.ts` — public API wrapper
- `tests/adapters/claude/resolution/resolver.test.ts`

## Acceptance

- [ ] Integrates: tools (M1-03), permissions (M1-04), filters (M1-02), trust (M1-06), plugin (F9)
- [ ] fork context: agent config not applied, enforcement unknown (T3)
- [ ] explore/plan: 0 instruction capabilities (I2)
- [ ] Each capability >=1 source and >=1 reason
- [ ] unknownRate computed
- [ ] warnings for ignored permissionMode, plugin fields, Bash guardrail
- [ ] Tests: foreground vs background vs fork differ

## Done checklist

- [ ] npm run test && npm run typecheck
