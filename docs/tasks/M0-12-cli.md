# M0-12: CLI scan, status, agents

## Goal

Wire CLI commands `scan`, `status`, and `agents` to return JSON from discovery layer.

## Spec refs

- SPEC §12.5 — CLI commands
- SPEC §10 Acceptance M0 — read-only discovery output

## Scope IN

- `src/cli/index.ts`
- `src/application/scan.ts` (only if shared helpers needed)
- `src/application/scan-store.ts` (new, in-memory last scan cache for status/agents)
- `tests/cli/commands.test.ts`

## Scope OUT

- Server API (M0-13)
- UI (M0-14)
- Resolver (M1)

## Acceptance

- [ ] `agent-manager scan [path]` outputs full ScanResult JSON (already partial — ensure stable shape)
- [ ] `agent-manager status` outputs JSON summary: projectPath, scannedAt, version, agent counts (active/invalid/ambiguous/shadowed), skills count
- [ ] `agent-manager agents` outputs JSON array of agents from last scan (or scans cwd if none)
- [ ] `status` and `agents` run scan on cwd when no prior scan in process
- [ ] Tests cover command output shape with mocked scan
- [ ] `npm run test` and `npm run typecheck` pass

## Done checklist

- [ ] npm run test
- [ ] npm run typecheck
- [ ] no writes to scanned project's .claude/**
