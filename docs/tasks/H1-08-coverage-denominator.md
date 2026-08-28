# H1-08: Coverage metric denominator = the §3 fact list

## Goal

The maturity metric is computed over the fixed §3 fact corpus, not over the subset the implementation happens to have registered.

## Spec refs

- SPEC §11.4 (не считать «процент точности»; фиксированный знаменатель по списку фактов §3)
- SPEC §13 invariant 13 (метрика тест-сьюта не отображается как свойство проекта пользователя)

## Scope IN

- tests/fixtures/coverage-report.ts
- tests/correctness-gate.test.ts

## Scope OUT

- `EffectiveConfiguration.unknownRate` — already correct and must stay the only number shown in the UI
- Fixture authoring — H1-09..H1-11

## Findings being fixed

`buildCoverageReport` (`coverage-report.ts:150-179`) iterates `M1_DOC_FACTS` — 12 facts — instead of the §3 list. It currently reports `fixture-verified: 11, documentation-only: 1, unverified: 0`, which reads as ~92% maturity against a true §3 coverage of roughly 11/83 ≈ 13%. §11.4 mandates the fixed denominator precisely so the implementation cannot shrink it. Additionally `coverage-report.ts:136-139` awards `fixture-verified` on directory existence alone, with no check that the fixture exercises the fact and no requirement that the matrix entry's own `confidence` was ever raised above `"doc"`.

## Acceptance

- [ ] Denominator is the full §3 registry from `facts.ts` (H1-05); `unverified` counts every registered fact with no matrix entry
- [ ] `fixture-verified` requires the named fixture to exist **and** the matrix entry `confidence` to be `"fixture"` or higher
- [ ] `runtime-observed` stays structurally possible but is 0 while the S0 fallback holds (§9.5)
- [ ] The report is emitted in the CI output only; no route or UI component exposes it (invariant 13) — grep-asserted
- [ ] Assertions are stronger than `fixtureVerified > 0`

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Expect the reported maturity to drop sharply. That is the point of the task — the metric is supposed to be monotone and honest (§11.4).

## Orchestrator verification (post-implementation)

Report printed directly from the built helper:

```
SPEC §3 facts       : 92
runtime-observed    : 0
fixture-verified    : 0
documentation-only  : 26
unverified          : 66
```

Buckets sum to 92 and the denominator is the registry, not the implementation's own scope. The previous report read `fixture-verified: 11, documentation-only: 1, unverified: 0` — roughly 92% maturity against a real §3 coverage now visible as 26/92 documented and 66 untouched. Accepted.

**`fixture-verified: 0` is correct, not a miscount.** Criterion 2 requires the matrix entry's own `confidence` to be `"fixture"` or higher, and all 24 entries are still `"doc"` — H1-06 left them there deliberately, because a fixture directory existing is not evidence that it exercises the fact. Fourteen facts (F2, F3, F4, F11, T1, T2, T3, P1, P2, P4, P5, K1, R1, R4) have a named on-disk fixture and sit in `documentation-only` until someone confirms the fixture actually pins the rule and promotes the entry.

**Consequence assigned:** promoting `confidence: "doc"` → `"fixture"` is now part of H1-09, H1-10 and H1-11, for the entries whose fixtures those tasks write or verify. Nobody may promote an entry without having read the fixture that justifies it.
