# H1-10: Fixture batch — `[ext]`-heavy and depth-limit areas

## Goal

Give the `[ext]` fact areas the fixture evidence §8.2 requires before any of them can back a confident verdict.

## Spec refs

- SPEC §11.1, §11.2
- SPEC S1–S8, K6, K7, N1, N2, N3, §3.11
- SPEC §8.2 (`[ext]` требует confidence >= fixture)

## Scope IN

- tests/fixtures/claude/settings-permissions/ (S1–S8)
- tests/fixtures/claude/skill-allowed-tools/ (K6, K7 — security finding)
- tests/fixtures/claude/depth-limit/ (N1, N2, N3)
- tests/fixtures/claude/environment/ (§3.11)

## Scope OUT

- Implementing settings-permission precedence itself if it is absent — raise as a blocker, do not expand scope
- Fixtures covered by H1-09 and H1-11

## Findings being fixed

All four are `.gitkeep`-only. `depth-limit/` is additionally named as the fixture of the `agent.depthLimit` matrix entry, which therefore merged without one (§0.1.3). S1–S8 precedence is not implemented in `resolution/` at all — S4 currently produces only a `securityWarning`, never a capability — so this fixture batch doubles as the specification of what H1-06's matrix entries must eventually gate.

## Acceptance

- [ ] Each fixture complete per §11.2
- [ ] `settings-permissions/` covers layer precedence (S1), deny-wins (S2), invalid MCP bracket syntax (S3), non-anchored `allow` glob that grants nothing (S4), bare tool name deny (S5), `Bash(cmd:*)` prefix matching (S6), `Read`/`Edit` gitignore globs (S7), `WebFetch` `domain:` prefix (S8)
- [ ] `skill-allowed-tools/` yields a **security finding**, never a restriction (K6) — including the `-p` in an untrusted folder case (K7)
- [ ] `depth-limit/` exercises `depth < maxDepth`, `depth >= maxDepth` (Agent removed, reason `depth-limit`, N2) and `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` (N3)
- [ ] `environment/` exercises the §3.11 variables via `env.json`, asserting key names only reach the snapshot
- [ ] Any S-fact not implemented resolves `unknown` in `expected.json` — golden files record honest unknowns, not aspirations

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

The golden files here are the contract for a later settings-permissions implementation. Recording `unknown` now is correct and expected (§11.3).

## Added by the orchestrator after H1-06 and H1-08

Beyond writing fixture content, each fixture task must close the loop on the matrix:

- [ ] Flip every matrix entry this task satisfies from `pendingFixture` to `fixture`
- [ ] Promote that entry's `confidence` from `"doc"` to `"fixture"` **only** after reading the fixture and confirming it actually exercises the rule — a directory existing is not evidence
- [ ] Shrink `EXPECTED_PENDING_FIXTURES` in `tests/correctness-gate.test.ts` accordingly; the corpus test fails until it matches reality

## Orchestrator verification (post-implementation)

Read the goldens directly:

- `environment`: all nine §3.11 rows present as key names with `origin` and normalized `effect`; the marker value planted in `env.json` and `settings.json` appears **zero** times in `expected.json`. `DEPLOY_API_TOKEN` survives as a key name only — invariant 10 holds.
- `skill-allowed-tools`: two `security-finding` warnings with `matrixRef: K6`, and tools absent from `allowed-tools` (`Edit`, `Glob`, `Grep`, `WebSearch`, …) remain `available`. Pre-approval is recorded as a finding and never as a restriction, which is the whole point of K6/K7.
- `settings-permissions`: S4 emits two `security-finding` warnings for the unanchored `*` and `mcp__*`; P4 produces an `ignored-field` warning because the higher-priority `settings.local.json` won.
- `depth-limit`: five contexts covering `depth < maxDepth`, `depth >= maxDepth` with reason `depth-limit`, the fork exemption, and `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`.

Suite 314 passed | 5 todo. Accepted.

**The S-fact instruction was followed correctly, and the result is more interesting than expected.** The agent's `tools` whitelist was designed so every tool a `deny` rule targets is already denied by F2 — so no golden line contradicts an S row and none blesses one. But that exposed a structural gap: an unimplemented rule surfaces as *no capability line at all*, not as `unknown`, because there is no capability id for `Bash(cmd:*)` or `Read(/src/**)`. Silence and undetermined are indistinguishable to a reader.

**Filed as H1-21:** §4.4 lists seven resolver rules and the product implements six — settings `permissions` never reach resolution. A tool denied by settings but permitted by frontmatter is reported `available`/`enforced`, which is the inverse of the example §6 uses to define `enforced`. This was in the ROADMAP as post-v0.1 backlog; it belongs with the blockers.

**Filed as H1-22:** fixture runs read the developer's `~/.claude/settings.json`, so the `environment` golden passes here only because this box has no such file.

**Correctly not done:** no matrix entries exist for S1–S8, K6, K7 or E1–E9, so only `agent.depthLimit` could be promoted. Inventing entries to raise the coverage number would have been the exact dishonesty H1-08 exists to prevent.
