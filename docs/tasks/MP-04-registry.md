# MP-04: Adapter registry + scan routing

## Goal

Introduce platform adapter registry and route scan/resolve through it; default platform remains `claude` with zero golden drift.

## Spec refs

- SPEC §12.2
- docs/CURSOR-FACTS.md (future adapters stub)
- docs/CODEX-FACTS.md

## Scope IN

- src/adapters/registry.ts (new)
- src/adapters/claude/adapter.ts (wrap existing exports as PlatformAdapter)
- src/application/scan.ts — `ScanOptions.platform?: PlatformId`
- src/application/scan-store.ts — persist platform in ScanResult
- src/application/resolve.ts — dispatch by snapshot.version.platform
- src/server/routes/project.ts — accept `platform` in POST /scan body
- src/cli/index.ts — `--platform` flag on scan
- tests for registry routing (smoke)

## Scope OUT

- Cursor/Codex discovery implementation (MP-C*, MP-X*)
- UI platform selector (MP-C12)
- Changing Claude adapter behaviour or golden outputs

## Acceptance

- [ ] `PlatformId = "claude" | "cursor" | "codex"`
- [ ] `getAdapter(platform)` returns Claude adapter for `"claude"`; cursor/codex throw clear "not implemented" or stub that fails scan gracefully until MP-C07/MP-X07
- [ ] Default scan path identical to today (no platform arg → claude)
- [ ] All existing tests pass; Claude goldens byte-identical
- [ ] `npm run test` and `npm run typecheck` pass

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Stub adapters for cursor/codex may live in `src/adapters/cursor/adapter.ts` and `src/adapters/codex/adapter.ts` exporting `ADAPTER_ID` and throwing `PlatformNotImplementedError` from scan methods until discovery lands.
