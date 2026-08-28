# H1-04: Wire the version matrix into enforcement and degraded mode

## Goal

`enforcement` is derived from the version matrix and the detected Claude version, and the degraded (no CLI) mode actually degrades version-sensitive conclusions to `unknown`.

## Spec refs

- SPEC §8.2 (фича без записи в матрице резолвится как `unknown`; `[ext]` требует confidence >= fixture)
- SPEC §8.3 (деградированный режим)
- SPEC §13 invariant 11

## Scope IN

- src/adapters/claude/version/index.ts (re-export the matrix)
- src/adapters/claude/version/matrix.ts (enforcement decision function)
- src/adapters/claude/resolution/*.ts (replace hardcoded `enforcement` literals)
- tests/adapters/claude/version/matrix.test.ts
- tests/adapters/claude/resolution/resolver.test.ts

## Scope OUT

- Registering the missing facts themselves — H1-05
- Adding the missing matrix entries — H1-06

## Findings being fixed

`lookupFeature` (`matrix.ts:170`) has **zero production callers**; `version/index.ts` does not even re-export `matrix.js`. Every `enforcement: "enforced"` in `src/adapters/claude/resolution/` is a hardcoded literal (`tools.ts:255,266-268,275,317`; `resolver.ts:159-161,212-215,309-311`; `skills.ts:115`). `matrix.ts:179-181` correctly returns `status: "unknown"` when `version === "unknown"`, but nothing consumes it, so with no `claude` CLI installed every capability is still emitted as `enforced` — contradicting §8.3.

## Acceptance

- [ ] A single function maps `(matrixId, detectedVersion, fact trust levels) → enforcement`, and every capability-producing site in `src/adapters/claude/resolution/` obtains `enforcement` through it
- [ ] `version === "unknown"` → all version-sensitive capabilities resolve `enforcement: "unknown"` with a `version`-typed reason
- [ ] A rule whose matrix id is absent resolves `unknown` (§8.2), and a test asserts this for an intentionally unregistered id
- [ ] `[ext]`-level facts cannot back `enforcement: "enforced"` unless the matrix entry has `confidence >= "fixture"` — asserted by a test that flips a fixture entry back to `doc`
- [ ] Every `ResolvedCapability` still carries ≥1 source and ≥1 reason (M1 acceptance #1)

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Depends on H1-05 for the fact trust levels to be readable; land H1-05 first or stub the trust lookup behind the same function signature.

## Orchestrator verification (post-implementation)

Verified end to end that the wiring is live rather than inert, by resolving the `basic` fixture twice:

| `claude --version` | detected | status/enforcement | unknownRate | missing source/reason |
|---|---|---|---|---|
| works | `2.1.250` | available/enforced ×4, denied/enforced ×27, available/advisory ×1 | 0 | 0 |
| fails (exit 127) | `"unknown"` | available/unknown ×5, denied/unknown ×27 | 1 | 0 |

Degraded mode downgrades every enforcement and keeps the source/reason contract intact. Accepted.

**"No golden changes needed" — checked, not taken on trust.** All 23 matrix entries reference only `[doc]` facts, so the `[ext]` gate is currently vacuous in production and is exercised only by the patched-entry test; and every gated entry except P4 has `minVersion: 2.1.0` while all eight fixtures pin `2.1.0` and none sets `disableBypassPermissionsMode`. The P4 test showing the same input resolving `unknown` at 2.1.0 and `enforced` at 2.1.223 is what proves the gate fires.

**Residual, filed rather than fixed here:** in degraded mode `status` stays `available`/`denied` while only `enforcement` drops to `unknown`, and the gate's own `isConfidentCapabilityStatus` treats `status` as the confident axis — so 32 claims are still held against goldens while the product says it does not know. That is a §8.3 reading this task's acceptance did not settle. Filed as H1-17. The implementation matches the acceptance criteria as written.

Two further follow-ups raised by the implementer, both correctly declined as out of scope: H1-18 (five matrix entries covering discovery/simulate paths are still never consulted) and H1-19 (`agent.toolAliases` registered with `minVersion: 2.1.63` but `expandAliases` ignores the version).
