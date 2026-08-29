# V0-01: UI project folder selection

## Goal

Let users pick which project to scan from the web UI — without CLI workarounds or manual API calls.

## Spec refs

- SPEC §12.4 M0 (`POST /api/project/scan` with optional `projectPath`)
- M0 goal (discovery viewer is usable on arbitrary local projects)

## Scope IN

- `src/ui/components/ScanPanel.tsx` — path field, Browse button, localStorage helpers
- `src/ui/App.tsx` — wire `projectPath` state, pass to scan
- `src/ui/api.ts` — `fetchProjectConfig`, `browseProjectFolder` (if server route added)
- `src/ui/styles.css` — scan toolbar layout for path + buttons
- `src/server/routes/project.ts` — `GET /api/project/config`, `POST /api/project/browse` (native folder dialog)
- `src/application/default-project-path.ts` — shared default when client omits path
- `tests/ui/scan-panel.test.ts` (or extend existing UI tests)
- `tests/server/project-routes.test.ts` — config + browse route tests (mock dialog)
- `tests/application/default-project-path.test.ts`

## Scope OUT

- `npm run dev -- <path>` CLI wrapper (separate convenience; not required here)
- Changes to discovery/resolver logic
- Remote / deployed hosting concerns

## Acceptance

- [x] Scan toolbar shows editable project path (placeholder e.g. `D:\projects\your-project`)
- [x] **Scan** sends trimmed path to `POST /api/project/scan`; empty → server default (`getDefaultProjectPath()`)
- [x] **Browse** opens native OS folder picker via `POST /api/project/browse`; chosen path fills the field (does not auto-scan)
- [x] Path persisted in `localStorage` key `capsight:projectPath` between sessions
- [x] Enter in path field triggers scan (when not disabled)
- [x] On load, UI pre-fills from localStorage; if empty, uses `GET /api/project/config` → `defaultProjectPath`
- [x] `getDefaultProjectPath()` reads `CAPSIGHT_PROJECT_PATH` env or falls back to `process.cwd()`
- [x] Server scan route uses `getDefaultProjectPath()` instead of raw `process.cwd()`
- [x] Tests cover storage helpers, default path resolution, and browse route (mocked — no real dialog in CI)

## Done checklist

- [x] `npm run test` passes (V0-01 tests; 14 pre-existing unrelated failures in trust/agents/golden/mcp-probe/purity)
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)

## Notes

Prior spike (chat 21b46a8e) had text-input-only UI; this task adds Browse via server-side native dialog so Windows users don't have to type paths manually.

Browse implementation hint (no new npm deps): spawn platform command — PowerShell `FolderBrowserDialog` on Windows; `osascript` choose folder on macOS; `zenity --file-selection --directory` on Linux when available. Return `{ cancelled: true }` when user dismisses.
