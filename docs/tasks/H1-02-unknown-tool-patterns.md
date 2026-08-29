# H1-02: Unparseable tools patterns must not silently disable the whitelist

## Goal

An agent whose `tools:` entries cannot be parsed never resolves to "whole parent pool available".

## Spec refs

- SPEC §0.1.2 (уверенно неверный ответ — критический дефект)
- SPEC §13 invariant 4 (`unknown` никогда не превращается в allow или deny)
- SPEC F2, F3, F4

## Scope IN

- src/adapters/claude/resolution/tools.ts
- tests/adapters/claude/resolution/tools.test.ts

## Scope OUT

- Trust unknown state — H1-03
- Adding new pattern syntaxes to the parser (only classification of the unparsed case changes)

## Findings being fixed

`tools.ts:78-80` classifies any pattern containing `(` or `)` as `kind: "unknown"`. `tools.ts:206-209` then filters those out of `effectiveWhitelist`, so `applyWhitelist` becomes `false` and the whitelist branch is skipped entirely. An agent declaring `tools: ["Bash(git diff:*)"]` therefore has the entire inherited pool emitted as `status: "available", enforcement: "enforced"` (`tools.ts:314-326`) with reason "Inherited from parent session tool pool." The separate `unknown` capabilities emitted at `tools.ts:172-192` do not suppress those verdicts.

Note F5: `Agent(type1, type2)` is a legitimate parenthesised form that is ignored inside a subagent definition — classify it per F5 rather than as a blanket unknown.

## Acceptance

- [ ] `tools` declared but zero patterns parse → no capability is reported `available`; every tool in the pool resolves `status: "unknown"`, `enforcement: "unknown"` with a reason naming the unparsed pattern
- [ ] `tools` with a mix of parsed and unparsed patterns → parsed ones apply; the unparsed ones downgrade only what they could have matched, never widen the result
- [ ] `Agent(type1, type2)` handled per F5 (ignored inside a subagent definition, effective as main session) and not counted as unparseable
- [ ] Regression test asserts the exact failure case `tools: ["Bash(git diff:*)"]` does not yield `Bash`… or any other tool as `available`

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

This is the single most dangerous finding of the audit: it converts an unreadable restriction into a confident permission.

## Orchestrator verification (post-implementation)

Verified independently of the unit tests, by resolving two agent files through the application service:

| Agent | `tools` | available | unknown | denied |
|---|---|---|---|---|
| `danger` | `["Bash(git diff:*)"]` | — | all 30 | 0 |
| `mixed` | `["Read", "Bash(git diff:*)"]` | `Read` | `Bash` | 27 |
| `emptylist` | `[]` | — | — | 29 |

The audit's failure case now yields nothing `available`. Accepted.

**Behaviour change recorded:** `tools: []` denies everything instead of inheriting the parent pool. This follows F4 — a `tools` list that resolves to no tool means the subagent does not launch — and it is the safe direction. If a later fixture shows the platform treats `[]` as "unset", this becomes a §8.4 discrepancy and the conclusion drops to `unknown`; `tools-filters` (H1-10 adjacent) is the place to pin it down.
