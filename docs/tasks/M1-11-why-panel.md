# M1-11: Why panel UI

## Goal

Why panel showing capability status, sources, reasons chain per §7.5.

## Scope IN

- `src/ui/components/WhyPanel.tsx`
- `src/ui/api.ts` — fetchExplain
- Wire in App when capability clicked from effective list

## Acceptance

- [ ] Click tool/capability in effective list opens Why panel
- [ ] Shows STATUS, CONTEXT, ENFORCEMENT, SOURCE, DENIED BY, CHAIN, EVIDENCE (matrixRef)
- [ ] Uses GET /api/capabilities/:id/explain

## Done checklist

- [ ] npm run test && npm run typecheck
