# V1-01: Warnings surface — security findings become visible

## Goal

Render resolver warnings and snapshot warnings in the browser, so the UI stops asserting restrictions without the caveat §2.4 makes mandatory.

## Spec refs

- SPEC §2.4 (language: never «cannot access X»; guardrail wording is required, not optional)
- SPEC §7.6 (security findings — «не блокирующая, но **заметная**»)
- SPEC §7.7 (description budget, A10)
- SPEC §13 invariant 12 (no security guarantee the platform does not give)

## Why this is a defect, not a feature

`src/adapters/claude/resolution/security-findings.ts:71` already produces the exact sentence the spec asks for:

> Agent has Bash access. Tool-level restrictions are a guardrail, not a complete security boundary.

A grep for warnings across `src/ui/` returns CSS class names and nothing else. Meanwhile `EffectiveCapabilities.tsx:43` renders a `denied` badge as a bare fact. A user of `agent-manager warnings` sees the caveat; a user of the dashboard sees the restriction without it, which is the one thing §2.4 forbids.

## Scope IN

- `src/ui/api.ts` — client for `GET /api/warnings` (route: `src/server/routes/agents.ts:109`)
- `src/ui/components/WarningsPanel.tsx` — new
- `src/ui/components/EffectiveCapabilities.tsx` — per-capability warning affordance
- `src/ui/components/EcosystemHealth.tsx` — existing severity counts drill down to messages
- `src/ui/App.tsx`, `src/ui/components/DashboardNav.tsx` — placement
- `src/ui/styles.css`
- `tests/ui/` — panel logic unit test

## Scope OUT

- Any change to how warnings are computed — the resolver is correct, only the surface is missing
- New API routes; `GET /api/warnings` and the effective payload already carry everything
- Declared vs effective pairs (V1-02), enforcement badges (V1-03)

## Design decisions

**Two sources, one panel.** Per-agent warnings arrive with `EffectiveConfiguration`; the cross-agent view comes from `GET /api/warnings`, which resolves every active agent and tags each warning with `agentId`. The panel shows the current agent by default and can widen to all agents; it does not fetch both for the same view.

**Severity is not a score.** Render `severity` and `category` as given. Do not aggregate into a single number — EC-07 already declined a health score for the same reason (§2.4).

**Evidence stays clickable.** Each `Warning` carries `evidence: SourceInfo[]` and optionally `matrixRef`. Show the source path and field path the way `WhyPanel.formatSourceLine` does; reuse it rather than reimplementing.

**Snapshot warnings are already half-surfaced.** `ecosystem-health.ts:260-300` buckets `snapshot.warnings` by severity and links them to canvas resources, and `EcosystemHealth.tsx:120-122` renders those counts. Only the messages are missing: make the existing count a way into the message list, do not build a second path.

**Volume.** Collapse by category when a project produces many; never truncate silently — a hidden warning is worse than a long list (§14).

## Acceptance

- [ ] The dashboard shows no fewer warnings than `agent-manager warnings` for the same project and context
- [ ] The Bash guardrail finding is visible whenever the resolver emits it, and reads exactly as the resolver wrote it
- [ ] `bypassPermissions`, ineffective `allow` globs (S4), skill pre-approval findings (K6/K7) and inline-MCP findings all reach the screen
- [ ] Each warning shows severity, category, message and its evidence source
- [ ] A health severity count opens the messages behind it; the count and the list cannot disagree
- [ ] A capability whose resolution produced a warning is identifiable from the capabilities list
- [ ] No warning text is composed in the UI — the UI renders what the resolver produced

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Do not paraphrase warning text in the UI layer. §2.4 wording is a contract; if a message reads badly, fix it in the adapter where the fact and its matrix reference live.
