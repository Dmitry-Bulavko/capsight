# M0-01: Detect claude --version + degraded mode

## Goal

Detect Claude Code CLI version via `claude --version`; when CLI is unavailable, return explicit degraded/unknown version without guessing from files.

## Spec refs

- SPEC §8.3 — version detection via `claude --version`; degraded mode when CLI unavailable
- SPEC §5 `PlatformVersion` — `{ platform, version, raw, detectedAt }`
- SPEC §10 Acceptance M0 #2 — show version or explicit «не определена»
- SPEC §10 Acceptance M0 #7 — only allowed external process is `claude --version`

## Scope IN

- `src/adapters/claude/version/detect.ts` — `detectClaudeVersion()` function
- `src/adapters/claude/version/index.ts` — re-export
- `src/application/scan.ts` — wire version into scan result (minimal)
- `tests/adapters/claude/version/detect.test.ts` — unit tests with mocked exec

## Scope OUT

- Full ProjectSnapshot assembly (M0-11)
- Agent/skill/settings discovery (M0-02+)
- Version matrix feature checks (M1)
- UI changes (M0-14)
- Reading version from config files (forbidden by §8.3)

## Acceptance

- [x] `detectClaudeVersion()` runs `claude --version` (or accepts injectable runner for tests)
- [x] On success: returns `PlatformVersion` with parsed semver from raw output, `platform: "claude"`, ISO `detectedAt`
- [x] On failure (CLI missing, non-zero exit, empty output): returns version `"unknown"`, empty or error raw, `degraded: true` flag or equivalent in result type
- [x] Never infers version from file contents
- [x] `scan()` includes detected version in its result (replace stub)
- [x] Unit tests cover: success parse, CLI not found, non-zero exit
- [x] `npm run test` and `npm run typecheck` pass

## Done checklist

- [x] npm run test
- [x] npm run typecheck
- [x] no writes to scanned project's .claude/**
- [x] TASKS.md updated by orchestrator (not implementer)

## Notes

Parse common `claude --version` output formats (e.g. `2.1.x (hash)`). Keep exec timeout reasonable (~5s).
