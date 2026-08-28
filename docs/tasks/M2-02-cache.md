# M2-02: Probe cache invalidation

## Goal

Invalidate MCP probe cache when configHash changes.

## Scope IN

- Extend `src/adapters/claude/probing/mcp-probe.ts` cache logic
- Tests for hash change invalidation

## Acceptance

- [ ] configHash computed from server config (no secrets)
- [ ] Stale cache ignored when hash differs
- [ ] Tests pass

## Done checklist

- [ ] npm run test && npm run typecheck
