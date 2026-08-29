# H1-27: Security findings contradict F9 for plugin agents

## Goal

The product stops issuing two warnings that cannot both be true about the same plugin agent.

## Spec refs

- SPEC F9 (для plugin-агентов поля `hooks`, `mcpServers`, `permissionMode` игнорируются)
- SPEC §7.6 (security findings)
- SPEC §13 invariants 3, 12, 14

## Scope IN

- src/adapters/claude/resolution/security-findings.ts
- tests/fixtures/claude/plugin-agents/expected.json
- tests covering the findings

## Scope OUT

- Changing F9 handling in `resolution/plugin.ts`, which is correct
- The trust capability path, which already returns nothing for plugin agents

## Finding

`security-findings.ts` never checks `isPluginAgent`. A plugin agent declaring `permissionMode: bypassPermissions` therefore receives, in the same resolution:

- an `ignored-field` warning saying plugin agents ignore frontmatter `permissionMode` (F9), and
- a P5 security finding saying the agent "declares permissionMode bypassPermissions, which skips permission prompts".

The second describes an effect the first says does not happen. The same applies to an R1 finding about an inline MCP server command that F9 says is ignored — and `buildTrustCapabilities` already returns `[]` for plugin agents, so the capability side and the warning side disagree with each other.

§2.4 forbids overstating what the configuration does; here the product overstates in the direction of alarm, which is still a wrong answer and erodes trust in the findings that are real.

## Acceptance

- [ ] A finding whose premise F9 nullifies is not emitted for a plugin agent
- [ ] The `ignored-field` warning still is — the user should know the field was written and does nothing
- [ ] Findings that remain true for a plugin agent (a skill pre-approving sensitive tools, an unanchored `allow` glob) are unaffected
- [ ] `plugin-agents/expected.json` regenerated; the diff should remove exactly the contradictory findings
- [ ] A test asserts the same declaration produces the finding for a project agent and not for a plugin one

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Found by H1-23, which recorded today's behaviour in the golden verbatim rather than quietly omitting it — so the fix will appear as a visible golden diff. That is the right way round.

## Orchestrator verification (post-implementation)

Golden diff is 28 deletions and zero insertions — exactly the two contradictory findings, nothing reordered:

```
- security-finding  P5  "Agent declares permissionMode bypassPermissions, which skips permission prompts."
- security-finding  R1  "Inline MCP server runs arbitrary command \"audit-server\" from agent frontmatter."
```

All three `ignored-field` warnings survive, so the user still learns that `hooks`, `mcpServers` and `permissionMode` were written and do nothing. Suite 465 passed. Accepted.

**The paired test is the right shape.** Asserting an absence in isolation would pass equally well if the finding had been deleted outright; asserting that one `configuration` yields `["P5", "R1"]` for a project agent and `[]` for a plugin one pins both halves. A second test keeps the Bash guardrail, K6 and S4 firing for plugin agents, since none of those rests on an F9 field.

**Built on the shared predicate,** `isPluginIneffectiveField` from `resolution/plugin.ts`, so the F9 field list has one definition. `hooks` has no finding today; when one is added it inherits the suppression rather than reintroducing the contradiction.

**Asymmetry noted and correctly left alone:** the `ignored-field` warning is gated through `agent.pluginFieldLimits`, so on a version where F9 is undetermined it softens, while the suppression is unconditional. That matches `buildTrustCapabilities`, which already returns `[]` for plugin agents regardless of the matrix verdict — so this makes the two sides consistent rather than introducing a new inconsistency. If suppression should later follow the matrix verdict, both call sites move together.
