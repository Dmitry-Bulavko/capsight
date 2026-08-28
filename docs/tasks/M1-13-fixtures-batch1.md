# M1-13: Fixture batch tools/background/fork

## Goal

Create golden fixtures: tools-filters, background, fork with project trees + expected.json.

## Spec refs

- SPEC §11.1 fixture list

## Scope IN

- `tests/fixtures/claude/tools-filters/`
- `tests/fixtures/claude/background/`
- `tests/fixtures/claude/fork/`
- Extend `tests/fixtures/run-golden.test.ts` to run all fixtures with expected.json

## Acceptance

- [ ] Each fixture has project/, env.json, version.txt, contexts.json, expected.json
- [ ] Golden tests pass for all three
- [ ] Honest unknown where facts unverified

## Done checklist

- [ ] npm run test && npm run typecheck
