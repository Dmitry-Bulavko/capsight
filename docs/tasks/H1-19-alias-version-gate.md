# H1-19: Version-gate the Agent/Task alias expansion

## Goal

`Task` is treated as an alias of `Agent` only on versions where the rename had happened.

## Spec refs

- SPEC F11 (`Task` переименован в `Agent` в v2.1.63; `Task(...)` остаётся рабочим алиасом)
- SPEC §8.2, §13 invariant 11

## Scope IN

- src/adapters/claude/resolution/tools.ts (`expandAliases`)
- src/adapters/claude/version/matrix.ts (`agent.toolAliases` is already registered, minVersion 2.1.63)
- tests/adapters/claude/resolution/tools.test.ts

## Scope OUT

- Any other alias relationship
- The gating mechanism itself, delivered by H1-04

## Finding

`agent.toolAliases` is registered with `minVersion: "2.1.63"` but `expandAliases` treats `Agent` and `Task` as interchangeable on every version, including below 2.1.63 where the rename had not yet happened. The entry exists and is not consulted on this path.

## Acceptance

- [ ] Below `2.1.63`, a verdict that depended on alias expansion resolves `unknown` rather than asserting the pre-rename name behaves like the post-rename one
- [ ] At or above `2.1.63`, behaviour is unchanged
- [ ] In degraded mode (`version: "unknown"`), alias-dependent verdicts are undetermined
- [ ] A verdict that did not depend on alias expansion is unaffected — the downgrade must be per-match, not blanket

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Raised by the H1-04 implementation, which correctly declined to do it in scope: it needs per-match tracking of which verdicts relied on the expansion.
