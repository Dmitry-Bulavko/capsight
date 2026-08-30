# EC-02: Multi-platform detection and merged ecosystem inventory

## Goal

Scan every platform whose artifacts are actually present in the project and merge the per-platform snapshots into one declared inventory, with local-vs-repository duplicates linked rather than collapsed.

## Spec refs

- SPEC §7.1 (discovery, read-only), §7.4 (declared vs effective)
- SPEC §5 (`ProjectSnapshot`, `SourceInfo.scope`), §12.2 (structure)
- A1/A3/A4 (collision rules — reused, not reimplemented)
- SPEC §13 invariants 1, 2

## Scope IN

- `src/application/detect-platforms.ts` — presence detection with evidence
- `src/application/ecosystem.ts` — merge into `EcosystemInventory`
- `src/core/model/ecosystem.ts` — inventory types
- `src/application/scan-store.ts` — store per-platform results instead of a single `lastScan`
- `tests/application/detect-platforms.test.ts`, `tests/application/ecosystem.test.ts`

## Scope OUT

- API surface (EC-03), UI (EC-04+)
- Changing any adapter's own discovery
- Cross-platform resolution — the inventory is **declared only**, no `EffectiveConfiguration`

## Design decisions

**Detection is evidence-based and honours shared artifacts.** A platform is scanned when any artifact class it consumes is present, per `docs/COMPAT-FACTS.md` (EC-01) — not when its own dot-directory exists. `AGENTS.md` alone therefore enables both Cursor and Codex. Detection returns, per platform:

```ts
{ platform, status: "detected" | "not-detected", evidence: SourceInfo[] }
```

A `not-detected` platform is still listed (the filter in EC-05 can force-include it — that is the "what would break if we adopted X" reading the assessment case wants).

**The store stops being single-slot.** `lastScan` becomes a map keyed by platform plus the detection record. `getLastScan()` keeps its current single-platform meaning for the existing Context/Agents/Capabilities/Graph tabs so those screens are untouched.

**Duplicates are linked, never merged.** Two resources with the same identity in different scopes stay two inventory entries joined by an `overlaps` relation carrying the existing `Agent.collision` verdict where the platform has one. Where a platform states no winner (A4) or the matrix does not found one, the relation records `effective: undefined` — the UI must be able to draw "these two collide and we do not know which wins".

**Scan cost.** Detection runs first and cheaply; only detected platforms are scanned. Version detection still spawns at most one `<cli> --version` per detected platform and nothing else (§3 scan allowance).

## Acceptance

- [x] `detectPlatforms(projectPath)` returns all three platforms with `detected` / `not-detected` and the evidence paths behind each verdict
- [x] A project with only `AGENTS.md` detects Cursor **and** Codex
- [x] `buildEcosystemInventory` returns resources grouped by kind (`agent` / `skill` / `mcp_server` / `instruction`), each carrying `platform`, `scope`, `resourceClass`, `path`, `id`
- [x] `scope === "local"` (and `"user"`) is preserved verbatim from `SourceInfo` — no new local-detection logic
- [x] Same-identity resources across scopes produce an `overlaps` relation reusing the adapter's collision verdict, including the no-winner case
- [x] Only detected platforms are scanned; a `not-detected` platform spawns no process (exception: active platform force-scanned for single-platform backward compat)
- [x] Existing single-platform surfaces (`/api/agents`, `/api/effective`, `/api/graph`) behave exactly as before

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)

## Notes

The inventory is the declared half of §7.4 and must not acquire a resolver. If a question needs an execution context to answer, it belongs on the Graph tab, not here.
