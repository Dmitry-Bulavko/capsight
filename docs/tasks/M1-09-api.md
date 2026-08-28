# M1-09: M1 API routes

## Goal

Add M1 API routes for effective config, explain, warnings.

## Spec refs

- SPEC §12.4 M1

## Scope IN

- `src/server/routes/agents.ts`
- Wire in `src/server/index.ts` or project routes
- `tests/server/agents-routes.test.ts`

## Acceptance

- [ ] GET /api/agents/:id/effective?context=&depth=&parentMode=
- [ ] GET /api/capabilities/:id/explain?agent=&context=
- [ ] GET /api/warnings
- [ ] Requires prior scan (404 otherwise)
- [ ] Supertest tests

## Done checklist

- [ ] npm run test && npm run typecheck
