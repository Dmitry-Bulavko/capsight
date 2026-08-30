# V1-07: Plan preview (read-only) and recorded editor deferrals

## Goal

Render the M3 plan diff read-only in the browser, and record in TASKS why apply, rollback, history and MCP probe stay CLI-only.

## Spec refs

- SPEC §10 Acceptance M3 #2 (diff shows the exact set of files and fields; no change outside the plan)
- SPEC §12.4 M3 (`POST /api/plan`)
- SPEC §14 (editing is priority 7 of 8; anything workflow-shaped is 8th)
- SPEC §13 invariant 6 (no write to `.claude/**` outside an explicit Apply)

## Why the phase stops here

`POST /api/apply`, `POST /api/rollback/:id` and `GET /api/history` are implemented and reachable from the CLI. Building their UI means a confirm dialog, a snapshot-changed 409 flow, and a destructive-action path — the most expensive work in V1, spent on the priority the spec ranks second-to-last. V1 ships the read-only half, which is where the explanatory value is, and writes the deferral down instead of leaving it as an absence.

## Scope IN

- `src/ui/api.ts` — client for `POST /api/plan`
- `src/ui/components/PlanPreview.tsx` — new, read-only
- `src/ui/components/AgentEditor.tsx` — entry point from pending edits
- `src/ui/styles.css`
- `docs/TASKS.md` — the deferral table under the V1 section
- `tests/ui/`

## Scope OUT

- `POST /api/apply`, `POST /api/rollback/:id`, `GET /api/history` clients — deferred, recorded
- Any button that writes
- Cursor/Codex editing — `assertClaudePlatform` rejects it, and widening that is a separate decision

## Design decisions

**No apply button anywhere in this task.** A preview with a disabled apply invites a bug report; a preview that states «apply is available in `agent-manager apply`» states the truth. Name the CLI command.

**Diff is files and fields, exactly.** Render what the plan returns. Nothing summarised, nothing inferred; §10 M3 #2 is about exactness.

**Claude-only, said out loud.** `editor-store.ts` types against `ClaudeAgent` and the plan API returns `UnsupportedPlatformError` for other platforms. Under a non-Claude platform the preview is disabled with that reason shown, not hidden.

**Snapshot age is worth showing even read-only.** If `ProjectSnapshot.id` has changed since the pending edits began, say so in the preview. The user then knows the diff is stale before they reach for the CLI.

**The word verified stays out.** §10 M3 #6 — no observation layer exists, so nothing here is verified (invariant 5, §14).

## Acceptance

- [ ] Pending tool toggles produce a plan preview showing the exact files and fields that would change
- [ ] No control in the preview writes anything; the apply path is named as a CLI command
- [ ] A changed `ProjectSnapshot.id` is surfaced in the preview
- [ ] Under a non-Claude platform the preview is disabled with the platform reason visible
- [ ] The deferral table for apply / rollback / history / probe is present in `docs/TASKS.md` with a reason per row
- [ ] The word "verified" appears nowhere in the new UI

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

The deferral table is content the orchestrator owns; the implementer returns the wording in the handoff rather than editing TASKS directly, per the workflow rule.
