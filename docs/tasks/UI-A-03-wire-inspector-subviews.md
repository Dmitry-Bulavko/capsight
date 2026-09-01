# UI-A-03: Wire inspector sub-views

## Goal

Compose existing effective-layer components into the Agents workspace right panel sub-tabs and deduplicate `DeclaredEffectivePanel`.

## Spec refs

- SPEC §7.4 (declared vs effective pairs — P1, P2, F8, F9, T3)
- SPEC §2.4 (security findings visible)
- Invariant 3 (enforcement on capability rows)

## Scope IN

- `src/ui/components/AgentsWorkspace.tsx`
- `src/ui/components/ContextSelector.tsx`
- `src/ui/components/EffectiveCapabilities.tsx`
- `src/ui/components/WhyPanel.tsx`
- `src/ui/components/WarningsPanel.tsx`
- `src/ui/components/AgentEditor.tsx`
- `src/ui/components/AgentList.tsx` — `AgentDeclaredConfiguration` for Overview sub-tab
- `src/ui/App.tsx` — pass props/callbacks into workspace

## Scope OUT

- Top nav collapse (UI-A-05)
- Graph per-agent (UI-A-04)
- Ecosystem bridge target change (UI-A-06)

## Design decisions

**Overview sub-tab:** single-agent declared configuration block (from current `AgentList` detail).

**Context sub-tab:** `ContextSelector` only — preset radios, unknown rate. No `DeclaredEffectivePanel` here if it lives on Capabilities.

**Capabilities sub-tab:** `DeclaredEffectivePanel` + `EffectiveCapabilities` + `WhyPanel` when capability selected. **Render `DeclaredEffectivePanel` exactly once** across the workspace.

**Warnings sub-tab:** `WarningsPanel` with existing agent/all scope toggle.

**Editor sub-tab:** `AgentEditor` with pending badge on sub-tab label (count from `editorPending`).

**Context chrome:** move context preset selector into workspace chrome (above master-detail) so it is visible across all sub-tabs. Reuse `ContextSelector` preset UI or extract preset control only.

## Acceptance

- [x] Each sub-tab renders the correct existing component with current data wiring
- [x] `DeclaredEffectivePanel` appears in one place only
- [x] Context preset in workspace chrome refetches effective config on change
- [x] Why panel opens from Capabilities selection within workspace
- [x] Editor pending count shows on Editor sub-tab
- [x] `npm run test` and `npm run typecheck` pass

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)

## Notes

Branch: `feat/ui-a-agents-workspace`. DriftBanner moves in UI-A-05.
