# G1-MP-01: Cursor maxVersion drift demo

## Goal

Prove §8.4 scoped version downgrade on Cursor: one `status: "supported"` matrix entry with `maxVersion` downgrades above the bound while a neighbor rule stays confident.

## Spec refs

- SPEC §8.4
- SPEC §11.1–§11.3
- G1-04 pattern (Claude `agent.tools` at 2.1.499)

## Scope IN

- `src/adapters/cursor/version/matrix.ts` — add `maxVersion` to one fixture-backed confident entry (e.g. `rules.fileExtension` or `discovery.commands`)
- `tests/fixtures/cursor/` — new `version-drift/` fixture or extend existing with `version.txt` above max
- `tests/adapters/cursor/version/matrix.test.ts` — deletion/drift assertions
- `tests/fixtures/run-cursor-golden.test.ts` if new fixture

## Scope OUT

- Codex (G1-MP-02)
- UI (DriftBanner already reads resolver downgrades)
- Claude matrix changes

## Acceptance

- [ ] At fixture version ≤ maxVersion, target rule resolves enforced/supported on at least one golden capability
- [ ] With version above maxVersion, only that rule downgrades; at least one other rule stays enforced
- [ ] Golden + H1-28 deletion test pin the downgrade
- [ ] `npm run test` and `npm run typecheck` pass

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.cursor/**`
- [ ] TASKS.md updated by orchestrator (not implementer)
