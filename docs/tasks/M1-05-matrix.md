# M1-05: Version matrix + facts

## Goal

Populate version matrix with M1 resolver features and facts.ts fact registry.

## Spec refs

- SPEC §8.1, §8.2
- Fact IDs used in M1-03, M1-04, filters

## Scope IN

- `src/adapters/claude/version/facts.ts` — fact ID constants
- `src/adapters/claude/version/matrix.ts` — entries for agent.disallowedTools, context.filter1/2, permission.inheritance, etc.
- `tests/adapters/claude/version/matrix.test.ts`

## Acceptance

- [ ] facts.ts exports all [doc] fact refs used by M1 code
- [ ] matrix entries for each resolver rule with matrixRef ids
- [ ] lookupFeature(id, version) helper
- [ ] Tests for known feature lookup

## Done checklist

- [ ] npm run test && npm run typecheck
