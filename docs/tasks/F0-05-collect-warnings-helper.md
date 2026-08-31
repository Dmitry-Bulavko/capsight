# F0-05: Shared collectAgentWarnings helper

## Goal

Extract duplicated active-agent warning aggregation from CLI and API into `src/application/`.

## Spec refs

- SPEC §12.5 (CLI parity)
- SPEC §7.6
- V1 gate (browser ≥ CLI warnings)

## Scope IN

- `src/application/collect-warnings.ts` — new
- `src/cli/index.ts` — `runWarnings` delegates
- `src/server/routes/agents.ts` — `GET /api/warnings` delegates
- `tests/application/collect-warnings.test.ts` or extend `tests/server/agents-routes.test.ts`

## Scope OUT

- UI changes
- New warning types

## Acceptance

- [x] Single function collects warnings for all active agents given snapshot + context
- [x] CLI and API produce identical warning sets for same inputs
- [x] Existing CLI and agents-route tests pass
- [x] `npm run test` and `npm run typecheck` pass

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)
