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

## Orchestrator verification (post-implementation)

The per-match requirement — the reason two earlier tasks declined this — is demonstrated by the tests, at version 2.1.62:

| tool | how it was matched | verdict |
|---|---|---|
| `Agent` | named directly in `tools` | `denied` / `enforced` — untouched |
| `Task` | reached only via the alias | `unknown` / `unknown` + `agent.toolAliases` reason |
| `Read` | unrelated pattern | `available` / `enforced` — untouched |

And when a second pattern names the tool directly, the verdict survives on every version. That is per-match, not blanket. Degraded mode covered separately. Suite 419 passed | 1 todo. Accepted.

**Only `background` moved, and by exactly one added reason.** It is the sole fixture pinned below 2.1.63; its agent whitelists `Agent`, so `Task` entered the pool through the alias. The final verdict stays `denied`/`enforced` because filter 2 removes `Task` from a background subagent however it got in — the denial is true on both sides of the rename, and only the trace needed the version note. Diff confirmed as one reason object, nothing else.

**Correctly not gated:** a denial arising from the *absence* of any whitelist match. Alias expansion only ever adds matches, so such a verdict is identical with the alias on or off and never depended on it. Gating it would have been the blanket downgrade this task exists to avoid.

**Two assertions in `resolver.test.ts` were retargeted rather than deleted.** They asserted "no capability carries a version reason" and `unknownRate === 0` against a snapshot pinned at 2.1.0 — both now legitimately false for exactly one capability. They were replaced with stricter statements (every version-gated capability is gated on `agent.toolAliases`; the foreground unknown set is exactly `["Task"]`), so a stray future downgrade still fails them.
