# V0-01: UI project folder selection

## Goal

Let users pick which project to scan from the web UI — without CLI workarounds for typical desktop use, with a headless fallback when native browse is unavailable.

## Spec refs

- SPEC §12.4 M0 (`POST /api/project/scan` with optional `projectPath`)
- M0 goal (discovery viewer is usable on arbitrary local projects)

## Scope IN

- `src/ui/components/ScanPanel.tsx` — browse + rescan row, conditional fallback path field
- `src/ui/App.tsx` — wire `projectPath` state, browse/rescan/scan flows
- `src/ui/api.ts` — `fetchProjectConfig`, `browseProjectFolder`
- `src/ui/styles.css` — scan toolbar layout
- `src/server/routes/project.ts` — `GET /api/project/config`, `POST /api/project/browse`, error reasons, mutex, timeout
- `src/server/middleware/api-guard.ts` — Origin + JSON Content-Type for mutating API routes
- `src/server/index.ts` — bind `127.0.0.1`
- `src/application/default-project-path.ts` — shared default when client omits path
- `tests/ui/scan-panel.test.ts`
- `tests/server/project-routes.test.ts`
- `tests/server/api-guard.test.ts`
- `tests/application/default-project-path.test.ts`

## Scope OUT

- `npm run dev -- <path>` CLI wrapper (separate convenience; not required here)
- Changes to discovery/resolver logic

## Acceptance

- [x] Scan toolbar is one row: folder button (icon + folder name or **Browse**) + **Rescan** icon button
- [x] **Rescan** is enabled only when a project path is already set; re-scans without opening the folder dialog
- [x] **Browse** opens native OS folder picker via `POST /api/project/browse`; chosen path auto-scans
- [x] When browse returns `reason: "unavailable"`, UI shows an error and a compact manual path field + Scan (headless fallback)
- [x] Path persisted in `localStorage` key `capsight:projectPath` between sessions
- [x] On load, UI pre-fills from localStorage; if empty, uses `GET /api/project/config` → `defaultProjectPath`
- [x] `getDefaultProjectPath()` reads `CAPSIGHT_PROJECT_PATH` env or falls back to `process.cwd()`
- [x] `/browse` and `/scan` return 500 on unexpected errors; browse has mutex, 5-minute timeout, and typed cancel reasons
- [x] API server binds `127.0.0.1`; mutating `/api/*` routes require allowed `Origin` (or none) and `Content-Type: application/json`
- [x] Tests cover storage helpers, default path, browse error/busy/unavailable, and API guard

## Done checklist

- [x] `npm run test` passes (V0-01 tests)
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)

## Notes

Desktop UX uses a single folder button (not a always-visible path field). Manual path entry appears only when the native picker is unavailable (headless/WSL/container).

Browse implementation: PowerShell `FolderBrowserDialog` on Windows; `osascript` on macOS; `zenity` on Linux when available.
