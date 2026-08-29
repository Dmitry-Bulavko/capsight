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
