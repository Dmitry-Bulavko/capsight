# V0-02: A bad project path is indistinguishable from a server failure

## Goal

A user who types a wrong path in the manual field learns that the path is wrong, without the API leaking internal error detail for genuine failures.

## Spec refs

- SPEC §12.4 M0 (`POST /api/project/scan`)
- M0 goal (discovery viewer is usable on arbitrary local projects)

## Scope IN

- `src/server/routes/project.ts` — validate the resolved path before `scanAndStore`
- `src/ui/api.ts` / `src/ui/App.tsx` — surface the 400 message as-is
- `tests/server/project-routes.test.ts`

## Scope OUT

- Restricting *which* directories may be scanned (a separate policy question)
- Discovery/resolver behaviour on a valid path

## Finding

V0-01 made manual path entry a first-class flow: when the native picker is unavailable (headless, WSL, container), the only way to choose a project is to type the path. In the same change `/scan` stopped returning error detail to the client — `respondServerError` logs the cause to stderr and answers `500 { error: "Project scan failed" }`.

Both decisions are right on their own, and together they leave the one case the user can actually fix with no signal: a typo in the path produces the same opaque message as an internal crash. The path came from the client, so echoing back "this path does not exist" leaks nothing.

## Acceptance

- [ ] `POST /api/project/scan` answers `400` with an actionable message when the resolved path does not exist or is not a directory
- [ ] `500` with the generic message stays for everything else, details still logged to stderr
- [ ] The UI shows the 400 message verbatim (it is user-facing text, not a stack trace)
- [ ] The default path (no `projectPath` in the body) is validated the same way
- [ ] Tests cover: missing path → 400, file-instead-of-directory → 400, scan throwing → 500 generic

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Raised in review of V0-01 (PR #2) and accepted as a follow-up rather than a merge blocker.
