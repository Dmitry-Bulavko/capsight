# S9P-01: Live probe harness + recorded payloads

## Goal

Close S9-DECISION criterion 2 infrastructure: dev-only probe harness with recorded fixture payloads and schema tests (CI-safe without live credentials).

## Spec refs

- SPEC §9.2, §9.4
- S9-DECISION.md criterion 2

## Scope IN

- `src/adapters/claude/probing/agent-sdk-spike.ts` — capture init `tools[]` from stream if present
- `tests/adapters/claude/probing/` — unit tests with mocked SDK; schema validation of recorded payloads
- `tests/fixtures/probes/agent-sdk/` — committed recorded payload(s) from basic fixture (live run OR honest synthetic from docs if no credentials)
- `docs/S9P-PROBE-FINDINGS.md` — findings log with payload cross-check vs resolver
- `src/adapters/claude/probing/README.md` — update run protocol

## Scope OUT

- Scan-path wiring
- MCP auto-start beyond fixture config
- Cursor/Codex probes

## Acceptance

- [x] Probe harness exports normalized result type including init `toolNames` when present
- [x] At least one recorded payload JSON committed for `claude/basic` fixture
- [x] Unit test validates recorded payload schema without live SDK
- [x] S9P-PROBE-FINDINGS documents what APIs populated vs absent
- [x] D4-06 unchanged; ordinary scan still no third-party processes except `claude --version`
- [x] `npm run test` and `npm run typecheck` pass

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)
