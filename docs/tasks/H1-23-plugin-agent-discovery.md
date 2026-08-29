# H1-23: Plugin agents are never discovered

## Goal

Agents supplied by plugins are found by a scan, so the plugin-specific rules the product already implements can actually fire.

## Spec refs

- SPEC A1 (plugin `agents/` is the lowest-priority scope), A6 (scoped id `plugin:subdir:name`), A8 (nameless plugin agent loads under its file name)
- SPEC F9 (plugin agents ignore `hooks`, `mcpServers`, `permissionMode`)
- SPEC §10 Acceptance M1 #6
- SPEC §11.1 (`plugin-agents/` fixture)

## Scope IN

- src/adapters/claude/discovery/agents.ts (`discoverAgentSources`)
- src/adapters/claude/discovery/project-walk.ts, snapshot.ts as needed
- src/adapters/claude/version/matrix.ts (`agent.pluginFieldLimits` is pending on this fixture)
- tests/fixtures/claude/plugin-agents/

## Scope OUT

- Plugin installation, marketplace, or anything else about plugins beyond locating their `agents/` directories
- Changing the downstream F9/A8 handling — it is already correct, just unreachable

## Finding

Nothing in `src/adapters/claude/discovery/` ever produces `isPluginAgent: true`. `discoverAgentSources()` emits project and nested-project scopes, `~/.claude/agents/`, and `--add-dir` roots — no plugin scope. No code computes the A6 scoped id; grepping for A6 finds only the fact row.

The downstream handling exists and is correct: `resolution/plugin.ts` marks `hooks`, `mcpServers` and `permissionMode` ineffective, and `parseAgentFile` has the A8 branch that loads a nameless plugin agent under its file name. Both are unreachable from `scan()`.

So M1 acceptance #6 — "поля plugin-агентов `hooks`/`mcpServers`/`permissionMode` помечены как неэффективные" — holds only for an agent constructed directly in a unit test, never for one a user actually has. This blocked the `plugin-agents/` fixture in H1-11: writing it would require the feature, not just the fixture.

## Acceptance

- [ ] A scan discovers agents from installed plugins' `agents/` directories, at the lowest priority per A1
- [ ] Subfolders contribute to the scoped id: `agents/review/security.md` in plugin `my-plugin` → `my-plugin:review:security` (A6)
- [ ] A plugin agent with no `name` or unparseable frontmatter still loads under its file name (A8), unlike a project agent, which is skipped (A7)
- [ ] `plugin-agents/` fixture is authored and asserts F9, A6 and A8; `agent.pluginFieldLimits` flips from `pendingFixture` to `fixture`
- [ ] `EXPECTED_PENDING_FIXTURES` becomes empty and the §11.1 corpus is 20/20
- [ ] Plugin roots are resolved from configuration, not from the developer's home in a way that makes fixtures machine-dependent (see H1-22)

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Raised by H1-11, which correctly refused to fake the fixture. This is a feature gap rather than a wrong answer, but it silently invalidates one M1 acceptance criterion, so it should not sit in a backlog unlabelled.

## Orchestrator verification (post-implementation)

The §11.1 corpus is complete: **20 of 20 fixtures, zero `todo`, 457 tests passing.**

From the regenerated golden:

```
reviewer       active     project
reviewer       shadowed   plugin   my-plugin:reviewer            rule=A1
security       active     plugin   my-plugin:review:security     (A6 — subfolder in the id)
legacy-helper  active     plugin   my-plugin:legacy-helper       (A8 — unparsable, loads anyway)
nameless       active     plugin   my-plugin:nameless            (A8 — no name, loads anyway)
broken         invalid    project                                 (A7 — same file, skipped)
```

A1, A6 and the A7/A8 inversion are all visible in one file, with the project counterpart of each plugin case sitting beside it. F9 is pinned too: three `ignored-field` warnings and a resolved `permission:default` despite a declared `bypassPermissions`. Accepted.

**The constraint that mattered was honoured.** Plugin roots are input, never inferred: nothing probes a home directory or an install convention, the plugin name comes from the manifest when readable and from the configured root's directory name otherwise, and both a fixture run and a real run take the same path. H1-22's isolated `$HOME` is untouched, and the fixture's plugin lives inside the fixture.

**Identity decision ratified:** `pluginScopedId` is a separate field, not a replacement for `name`. Collision identity stays the bare `name`, otherwise a plugin agent could never collide with a project agent and A1 would be unobservable — which is exactly what the golden now demonstrates.

**Confidence correctly left at `doc`** despite the fixture landing. A fixture verifies our implementation, not the platform, and every other entry follows that convention; raising it here alone would have made the coverage number move for the wrong reason.

**Filed as H1-27:** `security-findings.ts` ignores `isPluginAgent`, so a plugin agent gets both an `ignored-field` warning saying F9 nullifies its `permissionMode` and a P5 finding saying that same `permissionMode` skips permission prompts. The golden records this verbatim rather than hiding it, so the fix will show as a visible diff.
