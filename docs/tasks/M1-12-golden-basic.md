# M1-12: Golden fixture basic

## Goal

Add expected.json golden file for basic fixture per §11.2 contract.

## Scope IN

- `tests/fixtures/claude/basic/expected.json`
- `tests/fixtures/claude/basic/contexts.json`
- `tests/fixtures/claude/basic/version.txt`
- `tests/fixtures/claude/basic/env.json`
- `tests/fixtures/run-golden.test.ts` — runs scan+resolve against basic fixture

## Acceptance

- [ ] Fixture contract files present
- [ ] Golden test compares normalized discovery + resolution output
- [ ] Test passes on current resolver

## Done checklist

- [ ] npm run test && npm run typecheck
