# D5-04: Claude skills/instructions/builtins promotion

## Goal

Promote skills, instructions, and builtin facts from documentation-only to fixture-verified where D5-01 marks `promotion-owed`.

## Spec refs

- SPEC §3.6 (K1, K7, K11)
- SPEC §3.8 (I1)
- SPEC §3.9 (B2, B4)
- H1-28

## Scope IN

- `src/adapters/claude/version/matrix.ts`
- `tests/fixtures/claude/skills-preload/`, `skill-allowed-tools/`, `instructions/`, `builtin-agents/`
- `docs/EVIDENCE-PROMOTION.md` updates for refusals

## Scope OUT

- Environment (D5-05)
- B1 discovery channel (done)

## Expected candidates (confirm via D5-01)

| Fact | Entry | Notes |
|------|-------|-------|
| K1 | skills.preload | skills-preload fixture |
| K7 | skills.allowedToolsUntrusted | skill-allowed-tools |
| K11 | discovery.commandNamePrecedence | basic — entry fixture, verifiedFacts empty |
| I1 | instructions.hierarchy | instructions — I2 already verified |
| B2 | builtin.readOnly | instructions |
| B4 | discovery.builtinNameOverride | builtin-agents — override collision pinned, model clause F7 |

## Acceptance

- [x] Each promotion-owed fact promoted or refused
- [x] B4: promote override collision to verifiedFacts if deletion test passes; F7/model stays partial
- [x] D4-06 unchanged
- [x] `npm run test` and `npm run typecheck` pass

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)
