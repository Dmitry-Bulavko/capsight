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

## Orchestrator decision

**Ruling: `status` must downgrade where it is version-sensitive, and the gate must stop counting a claim with `enforcement: "unknown"` as confident. Both halves, not one.**

Reasoning. The two axes answer different questions. `status` answers "what does this configuration produce here"; `enforcement` answers "is that a guarantee or merely advisory". Reading 1 is right that these are independent in general — a `disallowedTools` deny is readable straight off the file, and stays readable even when we cannot vouch that the platform enforces it.

But it is wrong for the capabilities this actually concerns. Whether `Bash` survives is decided by which filter applies (T1, T2), by the depth limit (N2), by the plan-mode exemption. Those are the platform's behaviour, not the file's content. With no detected version we do not know which of them ran, so `denied` is not a weaker claim than usual — it is a claim we have no basis for. §8.3 says exactly this: version-sensitive *conclusions* become unknown, and a status produced by a version-gated rule is one of them.

The operational argument settles it. The gate's `isConfidentCapabilityStatus` keys on `status`, so today a degraded run still holds 32 claims against goldens while the product itself reports it does not know. Either the gate is checking claims the product disowns, or the product is making claims it cannot support. Both readings are bugs, and §0.1.2 ranks a confident wrong answer above every missing feature.

**Scope of the downgrade.** A capability downgrades its `status` when the matrix entry it was gated on resolved `unsupported` or `unknown` — the same signal `gateCapability` already computes. A capability that was never version-gated keeps its status, and its enforcement is unaffected. The distinction must be mechanical, derived from the gate, not a hand-maintained list.

**Consequence accepted.** In degraded mode `unknownRate` approaches 1 and the product says very little about resolution while discovery keeps working — agents, files, collisions and invalid reasons all still listed. That is precisely the degraded mode §8.3 describes, and it is the honest shape of "I cannot tell you what this agent gets without knowing which Claude Code is installed".

**Also required by this decision:** `tests/fixtures/claude/version-drift/expected.json` currently records `status: "denied"` with `enforcement: "unknown"` for the entry whose matrix status is `changed`. That golden encodes the behaviour this decision changes and must be regenerated and re-read.

## Orchestrator verification (post-implementation)

Measured both modes on the `basic` fixture:

| `claude --version` | version | capabilities | unknownRate | discovery |
|---|---|---|---|---|
| works | `2.1.251` | 4 available/enforced, 27 denied/enforced, 1 available/advisory | 0 | both agents active |
| fails | `"unknown"` | 32 × unknown/unknown | 1 | both agents active |

Discovery survives degradation in full, which is the half of §8.3 that must not regress. Only `version-drift/expected.json` moved, as predicted. Accepted.

**The regenerated golden shows the split in one file:** at depth 3 on Claude Code 2.1.217, `Agent` resolves `unknown`/`unknown` while keeping its whole chain — `declared` (F2), `depth-limit` (N2), then the `version` reason naming `agent.depthLimitDefault` — and `Artifact` in the same resolution stays `denied`/`enforced`, because `agent.tools` resolves `supported` at that version. Gated-and-unfounded versus gated-and-supported, visible side by side.

**Interpretation ratified.** The decision said "unsupported or unknown"; the entry driving `version-drift` has status `changed`. Treating `changed` as unfounded too — the rule being "anything but `supported`" — is correct and is what §8.4 requires: "понизить вывод до `unknown`, пока поведение не определено однозначно". A `changed` entry is precisely a rule whose behaviour diverged.

**Correctly excluded from the downgrade:** a `supported` entry resting on a non-`[doc]` fact without fixture evidence. There the platform behaviour is known and only the guarantee is not, which is exactly what the `enforcement` axis exists to express.

**Caught in passing:** the CLI test suite's mock `PlatformVersion` was `1.0.0`, below every `minVersion`, so it had been running entirely in a permanently-unsupported version without anyone noticing — invisible while status did not degrade.

**Filed as H1-25:** the H1-15 SIGTERM→SIGKILL test flaked once during this work.
