# M2-05: Managed simulation

## Goal

Read-only managed policy overlay simulation per §7.8.

## Scope IN

- `src/application/simulate.ts`
- `src/adapters/claude/discovery/managed-overlay.ts`
- CLI `simulate --managed <dir>`
- POST /api/simulate/managed
- Tests with managed-simulation fixture stub

## Acceptance

- [x] Overlays managed settings/agents on snapshot
- [x] Returns delta: shadowed agents, denied tools, model changes
- [x] No writes to project or managed bundle
- [x] Tests pass

## Done checklist

- [x] npm run test && npm run typecheck
