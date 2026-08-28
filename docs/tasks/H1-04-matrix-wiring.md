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
