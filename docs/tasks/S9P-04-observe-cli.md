# S9P-04: Dev-only observe CLI

## Goal

Explicit developer command to run observation probes on fixture projects (§9.4), not available on ordinary scan.

## Spec refs

- SPEC §9.4, §12.5 (dev-only observe)

## Scope IN

- `src/cli/commands/observe.ts` (or extend cli index)
- Uses S9P-01 probe harness + S9P-03 types for output
- `tests/cli/observe.test.ts` — documents dev-only guard, fixture path validation

## Scope OUT

- Scan/API auto-probe
- User project paths without explicit `--fixture`

## Acceptance

- [ ] `capsight observe --fixture <path>` runs probe harness, outputs JSON observations
- [ ] Rejects non-fixture paths under tests/fixtures/claude/
- [ ] Not registered as default scan behavior
- [ ] `npm run test` and `npm run typecheck` pass

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)
