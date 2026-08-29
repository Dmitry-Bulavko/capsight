# H1-29: The F8 model substitution asserts a value the platform does not document

## Goal

The simulation stops naming a substitute model as fact when which model the platform picks is undocumented.

## Spec refs

- SPEC F8 (значения `model` проверяются против организационного allowlist `availableModels`; при блокировке происходит подстановка другой модели)
- SPEC §0.1.1 (не угадывать семантику платформы), §0.1.2
- SPEC §7.8 (managed simulation), §13 invariant 14

## Scope IN

- src/application/simulate.ts (the model-substitution delta)
- src/adapters/claude/version/matrix.ts (`agent.modelAllowlist` notes)
- tests/fixtures/claude/managed-simulation/expected.json

## Scope OUT

- Whether a model is blocked at all — that part F8 does document
- The rest of the §7.8 delta

## Finding

`managed-simulation/expected.json` records `effective: "claude-sonnet-4"` with `enforcement: "enforced"` for a model the managed bundle blocks. F8 says a substitution happens; it does not say *which* model is substituted. The value comes from our own convention — the first entry of `availableModels` — so the product states as enforced fact something that is evidence about us rather than about Claude Code.

This is the §0.1.1 failure mode in its purest form: the part F8 establishes (this model is blocked, a substitution occurs) is asserted correctly, and the part it does not establish (the resulting model) is asserted with the same confidence.

H1-28 already recorded the problem in the entry's notes and stopped counting F8 as fixture-verified. The golden still makes the claim.

## Acceptance

- [ ] "This model is blocked and something is substituted" stays confident — F8 supports it
- [ ] The identity of the substitute resolves `unknown` unless a fixture or documentation establishes it
- [ ] The simulation delta distinguishes the two, so a reader can see what is known and what is not
- [ ] `managed-simulation/expected.json` regenerated; the diff should change only the substitute's confidence
- [ ] The `agent.modelAllowlist` note is updated to match what the entry then claims

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Raised by H1-28 while re-checking every entry's evidence. Small in code, and exactly the kind of claim §0.1.2 ranks above missing functionality.
