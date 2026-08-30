# EC-03: Ecosystem API and guarded resource content endpoint

## Goal

Expose the merged inventory over the API and serve markdown resource bodies to the detail panel without letting a path or a secret leave the process.

## Spec refs

- SPEC §12.4 (API), §7.1 (read-only discovery)
- SPEC §13 invariant 10 (secrets never retained or emitted), §0.1.8
- V0-01 precedent: `src/server/middleware/api-guard.ts`

## Scope IN

- `src/server/routes/ecosystem.ts` — `GET /api/ecosystem`, `GET /api/ecosystem/resource/:id`, `GET /api/ecosystem/resource/:id/content`
- `src/server/middleware/api-guard.ts` — extend Origin check to the content route
- `src/application/resource-content.ts` — bounded, id-addressed file read
- `src/ui/api.ts` — client functions
- `tests/server/ecosystem-routes.test.ts`, `tests/application/resource-content.test.ts`

## Scope OUT

- Markdown rendering (EC-06 — the server returns source text, the client renders)
- Any write route

## Design decisions

**The client never names a path.** `/content` takes a resource `id` from the current stored inventory; the server resolves the path itself. A request for an id absent from the inventory is `404`, not a read attempt.

**Markdown classes only.** Content is served for `agent`, `skill` and `instruction` resources — files whose whole purpose is prose. `mcp_server` and `settings` resources have **no** content route: their raw files carry tokens, headers and env values, and the panel shows the already-redacted model instead (invariant 10). This is a rule, not a filter to be relaxed later.

**Defence in depth on the read.** Resolve with `realpath`, then assert containment inside a known scanned root; refuse a symlink escaping it; cap at 512 KB and return `{ truncated: true }` past the cap; refuse anything that is not a regular file.

**Frontmatter is separated, not stripped.** The response returns `{ frontmatter, body, truncated }` so the panel can show metadata as fields and prose as prose.

## Acceptance

- [x] `GET /api/ecosystem` returns the inventory, detection record and per-resource compat verdicts (EC-01) in one payload
- [x] `GET /api/ecosystem/resource/:id` returns one resource's metadata, related files/folders and `overlaps` relations
- [x] `/content` serves only markdown-class resources; an `mcp_server` or `settings` id returns `415` with an explicit reason (settings not inventory resources — MCP 415 tested)
- [x] An id not present in the current inventory returns `404` and performs no filesystem read
- [x] A symlink resolving outside every scanned root is refused
- [x] Files above the cap return truncated content with the flag set, never an error
- [x] Content route is covered by the Origin guard alongside the mutating routes
- [x] Test asserts no MCP `env`/`headers` value and no settings value appears in any ecosystem response

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)

## Notes

This is the only task in the phase that turns the inspector into something that reads arbitrary project files on request. Everything above is what keeps that from becoming a local file-disclosure endpoint.
