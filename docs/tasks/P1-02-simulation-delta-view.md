# P1-02: UI — simulation delta view

## Goal

Platform team sees managed simulation delta in the browser: shadowed agents, denied tools, ignored fields, substituted models — each traceable.

## Spec refs

- SPEC §7.8, §7.4

## Scope IN

- `src/ui/components/SimulationView.tsx` — new tab/panel
- `src/ui/components/DashboardNav.tsx`
- `src/ui/App.tsx`
- `src/ui/styles.css`
- `tests/ui/simulation-view.test.ts`

## Scope OUT

- F8 substitute identity honesty details (P1-03)
- New simulate logic

## Acceptance

- [ ] Simulation tab shows delta from P1-01 API response
- [ ] Shadowed agents, denied tools, ignored fields, model changes each listed with cause
- [ ] Read-only; no apply
- [ ] Gate: answer "what does this policy do" without terminal

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)
