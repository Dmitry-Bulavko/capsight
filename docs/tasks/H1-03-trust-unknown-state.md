# H1-03: Trust resolution needs an `unknown` state

## Goal

An unreadable trust file or a source the trust rules do not cover resolves as `unknown`, never as `available` or `blocked`.

## Spec refs

- SPEC §7.2 (blocked_by_trust только для R1 и R5)
- SPEC R1, R2, R4, R5
- SPEC §13 invariants 3, 4

## Scope IN

- src/adapters/claude/discovery/trust.ts (`TrustState`)
- src/adapters/claude/resolution/trust.ts (`ResolveTrustResult`)
- src/adapters/claude/resolution/resolver.ts (`trustStatusToCapabilityStatus`)
- src/core/model/index.ts (`TrustState`)
- tests/adapters/claude/resolution/trust.test.ts

## Scope OUT

- Widening `blocked_by_trust` to any source beyond R1/R5 — the current scoping is correct and must stay
- `--add-dir` trust records (R6) — H1-11 fixture work

## Findings being fixed

1. `resolution/trust.ts:211-223` and `:110-121` return `status: "available"` while attaching a reason literally typed `"unknown"` ("Source is not an MCP configuration file."). `ResolveTrustResult.status` (`trust.ts:20-24`) has only `available | blocked_by_trust`, so an honest answer is not representable.
2. `resolver.ts:69-73` collapses everything non-blocked to `available` with `enforcement: "enforced"`.
3. `discovery/trust.ts` `catch { return { accepted: false, ... } }` makes an `EACCES` or malformed `~/.claude.json` indistinguishable from "trust not accepted", which then produces `blocked` — unknown → deny.

## Acceptance

- [ ] `TrustState` distinguishes `accepted: true | false | "unknown"` (or equivalent) and records why it is unknown
- [ ] `ResolveTrustResult.status` admits `unknown`; a reason typed `"unknown"` can no longer coexist with `status: "available"`
- [ ] Unreadable/malformed `~/.claude.json` → trust-dependent capabilities resolve `unknown` / `enforcement: "unknown"`, not `blocked`
- [ ] R4 sources (named reference, `~/.claude/agents/` inline, `--agents`, managed) still resolve `available` with an explicit R4 reason — not `unknown`
- [ ] `.mcp.json` servers still never carry `blocked_by_trust` (M1 acceptance #7 stays green)

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

`~/.claude.json` is read outside the project; a permission error there is normal on shared machines and must not be reported as a configuration guardrail.

## Orchestrator verification (post-implementation)

Resolved a project holding both gated resources (inline MCP server = R1, frontmatter hooks = R5) plus a `.mcp.json` server, against four trust states:

| `~/.claude.json` | trust state | inline MCP (R1) | hooks (R5) | `.mcp.json` server | blocked |
|---|---|---|---|---|---|
| record accepted | `true` | available | available | available | — |
| no record | `false` | blocked | blocked | available | R1, R5 only |
| malformed JSON | `"unknown"` | unknown/unknown | unknown/unknown | available | none |
| unreadable (EISDIR) | `"unknown"` | unknown/unknown | unknown/unknown | available | none |

`blocked_by_trust` stayed confined to R1/R5 in every case and the `.mcp.json` server was never marked (M1 acceptance #7 holds). Accepted.

**Note on testing:** an EACCES case cannot be reproduced in a root session — root reads a `chmod 000` file regardless — so EISDIR was used as the genuine read failure. An environment running as a non-root user should still be checked against EACCES when one is available.

**Judgment call accepted:** a *missing* `~/.claude.json` stays `accepted: false` rather than `unknown`. Absence of the file is a definite absence of a trust record (R3), not an undetermined one; treating it as unknown would push the ordinary first-run case into unknown for no gain.
