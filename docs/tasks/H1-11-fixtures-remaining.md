# H1-11: Fixture batch — remaining §11.1 corpus

## Goal

Close the §11.1 corpus so the golden runner and the gate cover all 20 declared fixtures.

## Spec refs

- SPEC §11.1, §11.2
- SPEC I1, I2, F9, A6, A8, A9, K12, §7.8, §8.4

## Scope IN

- tests/fixtures/claude/instructions/ (I1, I2)
- tests/fixtures/claude/plugin-agents/ (F9, A6, A8)
- tests/fixtures/claude/add-dir/ (A9, K12)
- tests/fixtures/claude/version-drift/ (§8.4)
- tests/fixtures/claude/managed-simulation/expected.json (currently missing)

## Scope OUT

- Fixtures covered by H1-09 and H1-10
- Changing simulate behaviour — it is already read-only and correct

## Findings being fixed

Four directories are `.gitkeep`-only. `managed-simulation/` has `project/`, `managed-bundle/`, `contexts.json`, `env.json` and `version.txt` but no `expected.json`, so §7.8 — the stated differentiator — has no golden coverage and is invisible to both the runner and the gate.

## Acceptance

- [ ] Each fixture complete per §11.2
- [ ] `instructions/` asserts a custom subagent receives the full CLAUDE.md hierarchy (I1) and that Explore/Plan resolve **0** instruction sources with an I2 reason (M1 acceptance #5)
- [ ] `plugin-agents/` asserts `hooks`/`mcpServers`/`permissionMode` marked ineffective (F9, M1 acceptance #6), scoped id `plugin:subdir:name` (A6), and a nameless plugin agent loading under its file name (A8)
- [ ] `add-dir/` asserts `.claude/agents/` and `.claude/skills/` of the added directory are picked up (A9, K12) while the rest of its configuration is not
- [ ] `version-drift/` encodes a §8.4 discrepancy: matrix entry `status: "changed"` with `observedIn`, and the conclusion downgraded to `unknown`
- [ ] `managed-simulation/expected.json` records the delta: which agents become shadowed, which tools denied, which fields ignored, which models substituted per F8

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

`version-drift/` is the one fixture that must stay `unknown` by design — it exists to prove the resolver does not guess (§8.4 item 4).
