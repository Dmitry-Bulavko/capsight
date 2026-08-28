# H1-17: Decide whether degraded mode must downgrade `status`, not only `enforcement`

## Goal

Settle, with evidence, whether a version-sensitive `status` may stay confident while `enforcement` is `unknown`.

## Spec refs

- SPEC §8.3 (если CLI недоступен — все version-sensitive выводы становятся `unknown`)
- SPEC §6 (три статуса enforcement)
- SPEC §11.3 (correctness gate — единственный блокирующий критерий)

## Scope IN

- src/adapters/claude/version/matrix.ts (`gateCapability`)
- src/adapters/claude/resolution/resolver.ts
- tests/fixtures/coverage-report.ts (`isConfidentCapabilityStatus`)
- a `version-drift`-adjacent fixture case, if the decision requires one

## Scope OUT

- Re-litigating H1-04's wiring, which is correct as scoped
- Changing `unknownRate`'s definition

## Finding

After H1-04, resolving the `basic` fixture with no working `claude` CLI gives:

```
detected version: "unknown"
status/enforcement: available/unknown ×5, denied/unknown ×27
unknownRate: 1
```

`enforcement` is honestly `unknown`, but `status` stays `available` / `denied`. Two readings collide:

1. §5 models `status` and `enforcement` as separate axes, so "the configuration reads as denied, and we cannot vouch the platform enforces it" is exactly what the model is for. This is the current behaviour.
2. §8.3 says version-sensitive *conclusions* become `unknown`, and whether a tool is denied at all is version-sensitive for the filter rules (T1/T2) and the depth limit (N2). Worse, the gate's own `isConfidentCapabilityStatus` treats `status` as the confident axis, so in degraded mode 32 confident claims are still held against goldens while the product itself says it does not know.

Reading 2 is the one that can produce a confidently wrong answer, which §0.1.2 ranks above completeness.

## Acceptance

- [ ] A decision is recorded here with its reasoning
- [ ] If status must downgrade: version-sensitive capabilities resolve `status: "unknown"` in degraded mode, and capabilities that are not version-sensitive (e.g. a plain `disallowedTools` deny) are identified explicitly rather than downgraded wholesale
- [ ] If status may stay: `isConfidentCapabilityStatus` is amended so the gate does not treat a claim with `enforcement: "unknown"` as confident, and the UI shows the distinction
- [ ] Either way, `unknownRate` still reflects what the user is told

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Raised by the orchestrator while verifying H1-04, not by the original audit. Schedule alongside H1-07, which touches the same gate predicate.
