# D1-04: S11 — additionalDirectories and enableAllProjectMcpServers

## Goal

Bring the two settings keys that are registered as a fact but reach no matrix entry and no resolver into the product, or found their absence.

## Spec refs

- SPEC §3.5 S11, §4.4 rule 7, §7.1
- SPEC §8.2 (gating), §6

## Scope IN

- `src/adapters/claude/discovery/settings.ts` — read both keys
- `src/adapters/claude/resolution/settings-permissions.ts` — their effect on the reported set
- `src/adapters/claude/version/matrix.ts` — new entries citing S11
- `tests/fixtures/claude/settings-permissions/` or a new fixture
- `tests/adapters/claude/resolution/settings-permissions.test.ts`

## Scope OUT

- `--add-dir` CLI handling (already covered by K12 / M0 #6)
- Probing whether an auto-approved MCP server actually starts (§7.9 is separate)

## Design decisions

**S11 is currently a fact with no consumer.** It appears in `facts.ts` and nowhere else — no matrix entry references it, so §11.4 counts it `unverified`. That is honest, and it is also a hole: both keys visibly change what a session reaches.

**Two independent claims, two entries.** `additionalDirectories` widens the file-access surface; `enableAllProjectMcpServers` auto-approves servers declared in `.mcp.json`. They share a fact ID but not a mechanism, so they get separate matrix entries and the fact is only counted `verifiedFacts` when a fixture exercises it **entire** (H1-28).

**Wording per §2.4.** `enableAllProjectMcpServers: true` reads as *"project MCP servers are approved without a prompt"*, never as *"MCP servers are trusted"* or *"sandbox disabled"*.

**Interaction with trust (R1/R5) must be stated, not assumed.** Whether auto-approval survives an untrusted project is a separate question; if §3 does not answer it, the resolution records `unknown` rather than picking the intuitive answer.

## Acceptance

- [ ] Both keys are discovered from every settings layer with scope and source path
- [ ] Each key has its own matrix entry citing S11, gated on the detected version
- [ ] Their effect appears in the resolved capability set with a reason and a source, or as an explicit `unknown` with the reason
- [ ] The trust interaction is either founded on §3 or recorded `unknown` — not guessed
- [ ] A fixture exercises both keys; S11 is claimed as `verifiedFacts` only if pinned entire
- [ ] No wording asserts a security boundary (§2.4)

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Of the four inert rules, this one has the clearest observable effect and the least ambiguity — the natural first depth task after the measurement fix.
