# EC-07: Ecosystem health readout

## Goal

Put a compact state-of-the-project readout beside the canvas so a reviewer reaches a verdict in seconds instead of exploring the graph — the assessment use case.

## Spec refs

- SPEC §11.4 (coverage, not accuracy), §6 (enforcement), §2.4 (wording)
- Existing: `buildStatusSummary`, `Warning[]`, `EffectiveConfiguration.unknownRate`

## Scope IN

- `src/application/ecosystem-health.ts`
- `src/ui/components/EcosystemHealth.tsx`
- `src/server/routes/ecosystem.ts` — include health in the payload
- `src/ui/styles.css`
- `tests/application/ecosystem-health.test.ts`

## Scope OUT

- Any score, grade, or ranking of a project
- Recommendations or AI-generated commentary (§2.3)

## Design decisions

**Counts and conditions, no score.** The readout states facts: agents active / invalid / shadowed / ambiguous; skills per platform; MCP servers with a `not-supported` or `unknown` verdict; local overrides of repository resources; instruction sources; snapshot-level warnings by severity. A single composite "maturity score" would be exactly the confident-and-wrong summary §14 rules out, and would be trivially gamed by anyone being assessed.

**Every number is a link.** Clicking a count filters the canvas to those resources. A readout you cannot drill into is a slide, not a tool.

**Unknowns are shown, not hidden.** The count of resources with `unknown` compat is a first-class line, next to the resolved ones.

**Reuse what exists.** `buildStatusSummary` already computes the agent counts. Aggregate across platforms rather than recomputing.

## Acceptance

- [ ] Readout renders beside the canvas with per-kind and per-platform counts
- [ ] Agent status counts match `buildStatusSummary` for each platform
- [ ] Local-override and unresolved-collision counts are shown separately
- [ ] Resources with `unknown` compat are counted explicitly
- [ ] Warning counts are grouped by severity and match the snapshot warnings
- [ ] Clicking any count filters the canvas to exactly those resources
- [ ] No aggregate score, grade or rating appears anywhere in the output

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

This is the task that makes the screen useful to the reviewer rather than impressive to them. If time runs short elsewhere in the phase, protect this one.
