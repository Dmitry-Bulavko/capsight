# M4-01: Choose the project folder to analyse

## Goal

The user picks which project directory Capsight inspects, from the UI and the API, instead of being limited to the server's own working directory.

## Spec refs

- SPEC §12.4 (`POST /api/project/scan`)
- SPEC §12.5 (`agent-manager scan [path]`)
- SPEC §10 Acceptance M0 — "first useful screen on a foreign repo"
- SPEC §2.1 (local read-only inspector), §13 inv 6, 8

## Scope IN

- `src/ui/components/ScanPanel.tsx`
- `src/ui/App.tsx`, `src/ui/api.ts`, `src/ui/styles.css`
- `src/server/routes/project.ts`
- `src/application/scan-store.ts`
- New: path-validation helper for the scan entry point
- `tests/` — server route tests, UI unit test for the picker

## Scope OUT

- Multi-project workspaces, recent-projects persistence beyond one entry (see Notes)
- Any change to discovery, resolution or the version matrix
- Any write into the selected project
- Platform switching — that is P1-01

## Finding

`ScanPanel.tsx` offers exactly one action, labelled "Scan current directory", and calls `onScan()` with no argument. `src/ui/api.ts:79` already accepts an optional `projectPath` and sends it in the body, and `src/server/routes/project.ts:11` already reads `req.body?.projectPath ?? process.cwd()` — so the transport exists end to end and only the UI has no way to supply a value. The CLI does have it (`scan [path]`, `src/cli/index.ts:280`).

Consequence: on the web surface the product can only inspect the directory the server happens to have been started in. The M0 acceptance goal — "first useful screen on a foreign repo" — is reachable from the CLI and not from the UI.

Two gaps sit behind the same entry point and belong to this task:

1. `projectPath` from the request body is passed straight to `scan()` with no validation. A path that does not exist, is not a directory, or is not readable surfaces as an unhandled rejection rather than a stated error. The server is local and read-only (inv 6, 8 hold — nothing here writes), so this is a correctness and error-reporting defect, not a sandbox escape, and should be fixed as such.
2. `scan-store.ts` holds a single module-level `lastScan`. Switching folders must replace it atomically: every downstream surface (`/api/agents`, `/api/graph`, Why panel) reads that one snapshot, and a half-switched store would attribute one project's agents to another project's path.

## Acceptance

- [ ] UI has a control to enter or pick a project path, pre-filled with the current scan's `projectPath` (or the server cwd when there is no scan yet)
- [ ] Scanning a different folder replaces the whole snapshot; the header shows which path the displayed results belong to
- [ ] `POST /api/project/scan` validates the path before scanning: non-existent, not-a-directory and unreadable each return a distinct 400-level error with a message naming the cause, never a stack trace or an unhandled rejection
- [ ] A relative `projectPath` is resolved against a documented base and the resolved absolute path is echoed back in the response
- [ ] "Scan current directory" remains available as the zero-argument default — the existing behaviour is not removed
- [ ] Switching projects clears derived state in the UI (selected agent, Why panel, graph) rather than leaving a stale selection from the previous project
- [ ] Server route tests cover: valid path, missing path, file-instead-of-directory, and the default-to-cwd case
- [ ] No writes anywhere under the selected project

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

**Native folder picker is out of reach here and should not be faked.** The UI is a browser page; `showDirectoryPicker()` gives a handle the Node server cannot read from, and `<input webkitdirectory>` uploads file contents rather than naming a path. So the control is a text input for an absolute path, plus optional convenience: server-side directory listing for autocomplete, or a short recent-paths list. Do not ship a button that looks like an OS folder dialog and silently does something else.

**Recent paths, if implemented, are local state** and belong under `.agent-manager/` per §12.3 — with the H1-16 gitignore warning already in place. Nothing about a scanned project may be written into that project.

Prerequisite for P1-01: once a platform switcher exists, the selected folder and the selected platform form one selection. Keep the scan entry point shaped so a second field can join `projectPath` without another round of route surgery.
