# G1-01: Version applicability per matrix entry

## Goal

Matrix entries declare version ranges; detected version outside range downgrades that rule, not the whole scan.

## Spec refs

- SPEC §8.1, §8.2, §8.4

## Scope IN

- `src/adapters/claude/version/matrix.ts`
- `src/adapters/cursor/version/matrix.ts`
- `src/adapters/codex/version/matrix.ts`
- `src/adapters/claude/version/resolve-enforcement.ts` (or equivalent lookup path)
- Cursor/Codex enforcement lookup if separate

## Scope OUT

- UI banner (G1-02)
- Fixture (G1-03)

## Acceptance

- [ ] Entries outside detected version resolve with degraded enforcement/status per §8.4
- [ ] Scan continues; only affected rules downgrade
- [ ] Existing goldens unchanged at default fixture version

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)
