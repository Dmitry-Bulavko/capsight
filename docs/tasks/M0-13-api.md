# M0-13: API scan, project, agents

## Goal

Expose M0 discovery endpoints: POST scan, GET project snapshot, GET agents list.

## Spec refs

- SPEC §12.4 M0 routes
- SPEC §10 Acceptance M0

## Scope IN

- `src/server/index.ts`
- `src/server/routes/project.ts` (new)
- `src/application/scan-store.ts` (reuse store from M0-12)
- `tests/server/project-routes.test.ts`

## Scope OUT

- UI (M0-14)
- M1 effective resolution routes

## Acceptance

- [ ] `POST /api/project/scan` — body `{ projectPath? }`, returns ScanResult, stores in server memory
- [ ] `GET /api/project` — returns last snapshot summary or 404 if never scanned
- [ ] `GET /api/agents` — returns `{ agents: Agent[] }` from last scan or 404
- [ ] Tests with supertest or fetch against express app
- [ ] `npm run test` and `npm run typecheck` pass

## Done checklist

- [ ] npm run test
- [ ] npm run typecheck
