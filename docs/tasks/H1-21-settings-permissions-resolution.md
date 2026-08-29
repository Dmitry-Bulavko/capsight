# H1-21: Settings permissions are never resolved — a denied tool can be reported available

## Goal

`permissions.deny` / `allow` / `ask` from the settings layers take part in resolution, as §4.4 rule 7 requires.

## Spec refs

- SPEC §4.4 rule 7 (правила `permissions.deny` из настроек применяются последними и не переопределяются ничем)
- SPEC S1–S8, S9, S10, S11
- SPEC §6 (`permissions.deny` is listed as the archetype of `enforced`)
- SPEC §13 invariants 3, 4, 14

## Scope IN

- src/adapters/claude/resolution/ (new settings-permission resolution stage)
- src/adapters/claude/discovery/settings.ts (layer contents, currently only `{scope, path, priority}`)
- src/adapters/claude/version/matrix.ts (entries for S1–S8; they do not exist)
- tests/fixtures/claude/settings-permissions/ (the fixture already carries the rule text as input)
- tests/fixtures/golden-normalize.ts (see finding 2)

## Scope OUT

- A permission engine of our own (§2.3 non-goal) — this resolves what the platform would apply, it does not enforce anything
- `skillOverrides` (K10) and `.claude/commands` precedence (K11)

## Finding

There is no settings-permission precedence stage at all. The only consumers of a `permissions` block are `readPermissionSettings`, which reads `disableBypassPermissionsMode` and nothing else, and `readFalseAllowGlobWarnings`, which emits the S4 warning. §4.4 lists seven resolver rules and the product implements six.

The consequence is not merely missing coverage. A tool that the settings deny, but that the agent's frontmatter permits, is reported `available` with `enforcement: "enforced"` — a confident wrong answer in the dangerous direction, and the exact inverse of what §6 uses `permissions.deny` as its example of. It is invisible today only because the H1-10 fixture was deliberately built so every S-denied tool was already denied by F2.

A second problem blocks honest reporting in the meantime: an unimplemented rule surfaces as **no capability line at all**, not as `unknown`. There is no capability id for `Bash(cmd:*)`, `Read(/src/**)` or `WebFetch(domain:...)`, so the golden schema has no slot for a rule-level unknown and silence is the only available encoding. A user cannot tell "this rule was considered and is undetermined" from "this rule was never read".

## Acceptance

- [ ] `permissions.deny` is applied last and overrides everything, including a permitting frontmatter and bypass modes (S2)
- [ ] Layer precedence managed > CLI > `.claude/settings.local.json` > `.claude/settings.json` > `~/.claude/settings.json` (S1)
- [ ] Pattern semantics per S3, S5, S6, S7, S8; a rule whose syntax is not understood resolves `unknown`, never ignored silently
- [ ] Matrix entries exist for each S-fact used, and since S1–S8 are `[ext]`, none may back `enforced` until its fixture confidence is raised (§8.2, already enforced by H1-04)
- [ ] A rule the resolver does not implement is representable and visible — decide between a capability id per rule or a rule-level report, and state the choice here.
      **Choice: a capability id per rule.** Every entry of every `permissions.allow`/`deny`/`ask`
      array becomes exactly one `kind: "permission"` capability with id
      `settings-permission:<scope>:<action>:<raw rule>`, carrying the rule's own source
      (`permissions.<action>[<index>]`), reason and enforcement. A rule the resolver cannot act on
      is then a visible `status: "unknown"` line instead of silence, and the existing golden schema
      needed no new slot.
- [ ] `settings-permissions/expected.json` is rewritten to assert real outcomes, replacing the current silence
- [ ] `normalizeDiscovery` stops filtering settings layers to `scope === "project"`, so `settings.local.json` — the layer that drives the S1 outcome — is visible in goldens (finding 2 of H1-10)

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

The ROADMAP listed this as post-v0.1 backlog. H1-10 showed it is not merely absent coverage but a live confident-wrong-answer path, so it belongs with the blocker-class tasks. The fixture written in H1-10 already contains the rule text as the input contract; this task supplies the expected output.

## Orchestrator verification (post-implementation)

This task was interrupted by an infrastructure limit and finished by a second implementer, which reviewed the partial work as a patch rather than continuing it blindly — and the review is what makes the result trustworthy.

**The decisive evidence, from the regenerated golden:**

```
resolution 2 — permission:bypassPermissions available
  Bash   denied / enforced
    declared                       Allowed by tools pattern "Bash" (F2)
    denied  settings.denyBareTool  permissions.deny entry "Bash" removes the tool entirely
  Write  denied / enforced          (same shape)
```

The frontmatter *permits* these tools and the parent session is in `bypassPermissions`; the settings `deny` is what denies them. That is §4.4 rule 7 and S2 actually demonstrated. Suite 446 passed | 1 todo, 19 of 21 goldens byte-identical. Accepted.

**The review caught overclaimed evidence, which is the failure this phase exists to prevent.** The rule was implemented correctly from the start, but the fixture repeated H1-10's flaw: the only agent whitelisted just `Read`/`Grep`/`WebFetch`, so every denied tool was already gone by F2 and the `bypassPermissions` declaration was already dead via P4. The deny rule was therefore never the operative cause of anything. On that basis `settings.denyBareTool` (S5) claimed `confidence: "fixture"` it did not have and `settings.denyPrecedence` (S2) carried a note describing behaviour the golden did not show. A new `permissive` agent supplies the missing evidence and both notes now state exactly what the golden proves.

**Mechanism accepted for representability:** one capability per rule, `settings-permission:<scope>:<action>:<raw>`, so a rule the resolver does not evaluate is a visible line resolving `unknown`, not an absence indistinguishable from "never read". A 23-rule battery goes in and 23 capabilities come out — nothing silently dropped, which was half the original finding.

**Two further confident-wrong-answers found and fixed beyond the checklist:** `deny: ["mcp__github__issues"]` left the matching MCP tool `available`/`enforced`, and `deny: ["Skill(audit)"]` left the skill `preloaded`/`enforced` — the same defect in the MCP and skill namespaces. Both now degrade to `unknown` citing the rule, and deliberately not to `denied`: S3 and S10 do not say what survives, so a confident denial would be a guess.

**Honest gaps left visible rather than papered over:** S6 prefix matching and S7 gitignore-glob matching are not implemented, so those rules resolve `unknown` with a reason saying so — the product records the rule without claiming to evaluate its argument. S11 is untouched, being `--add-dir` territory outside this handoff.
