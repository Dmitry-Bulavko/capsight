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

## Added by the orchestrator after H1-06 and H1-08

Beyond writing fixture content, each fixture task must close the loop on the matrix:

- [ ] Flip every matrix entry this task satisfies from `pendingFixture` to `fixture`
- [ ] Promote that entry's `confidence` from `"doc"` to `"fixture"` **only** after reading the fixture and confirming it actually exercises the rule — a directory existing is not evidence
- [ ] Shrink `EXPECTED_PENDING_FIXTURES` in `tests/correctness-gate.test.ts` accordingly; the corpus test fails until it matches reality

## Orchestrator verification (post-implementation)

Read the goldens directly:

```
instructions:  foreground-subagent  sources=3 (one per hierarchy level)  reason=I1
               explore              sources=0  reason=I2  status=denied
               plan                 sources=0  reason=I2  status=denied
version-drift: depth 3 → 2 capabilities enforcement=unknown, unknownRate 0.065
managed-simulation: golden carries a `simulation` section with the delta
```

Suite 322 passed | 1 todo. Four of five fixtures landed. Accepted.

**Resolver change accepted (blocker note 3).** Explore/Plan previously resolved instructions as an empty list with no explanation. §4.4 item 4 requires "инструкции резолвятся как 0 источников с reason по I2", so the reason was missing outright — the alternative was a golden asserting a reason the product does not emit, or dropping the capability and losing M1 acceptance #5. Emitting one capability with zero sources and an I2 reason is what the spec describes.

**`version-drift` keeps `status: denied` with `enforcement: unknown`.** That is the product's actual downgrade mechanism, the same as fork/T3, and recording it honestly is right. Whether `status` should also drop is exactly the open question filed as H1-17 — this fixture will need revisiting once that decision lands.

**Filed as H1-23 — `plugin-agents/` is blocked by a missing feature, not a missing fixture.** Nothing in discovery ever produces `isPluginAgent: true`; `discoverAgentSources()` has no plugin scope and nothing computes the A6 scoped id. The downstream F9/A8 handling in `resolution/plugin.ts` and `parseAgentFile` is correct but unreachable from `scan()`. M1 acceptance #6 therefore holds only for an agent built in a unit test, never for one a user has. Refusing to fake the fixture was the right call.

**A9/K12 have no matrix entry** — appended to H1-18, which already owns the discovery-level entry question.
