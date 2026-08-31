# V1-02: Declared vs effective pairs

## Goal

Show both values wherever a declared setting may not take effect, for the four cases SPEC §7.4 marks обязательные.

## Spec refs

- SPEC §7.4 («Везде, где declared-значение может не действовать, показывать оба» — обязательно для `permissionMode`, `model` F8, полей plugin-агентов F9, всей конфигурации в контексте `fork` T3)
- SPEC §10 Acceptance M1 #4 (declared and effective `permissionMode` shown separately; parent `auto` marks declared ignored — P2)
- SPEC §10 Acceptance M1 #6 (plugin agent `hooks`/`mcpServers`/`permissionMode` marked ineffective — F9)
- SPEC §10 Acceptance M1 #3 (`fork` does not apply agent configuration and says why — T3)

## Current state

`permissionMode` does not appear anywhere under `src/ui/`. The resolver computes all four cases (`resolution/permissions.ts`, `resolution/plugin.ts`, `resolution/resolver.ts` fork branch) and the CLI `explain` prints them. M1 acceptance #3, #4 and #6 are therefore satisfied in the terminal only.

## Scope IN

- `src/ui/components/DeclaredEffective.tsx` — new, reusable pair renderer
- `src/ui/App.tsx` — placement on Context and/or Capabilities
- `src/ui/components/AgentSelector.tsx` or `ContextSelector.tsx` — fork notice placement
- `src/ui/styles.css`
- `tests/ui/`

## Scope OUT

- New resolution logic for any of the four cases
- Declared frontmatter block in the Agents tab (V1-04) — this task renders *pairs*, not the whole declaration
- Warnings panel (V1-01), though the reason text may reuse the same `Warning` shape

## Design decisions

**One component, four callers.** The spec's example layout is a value pair plus a reason plus a fact reference. Build it once:

```
permissionMode
  Declared:  acceptEdits      (.claude/agents/backend.md)
  Effective: auto
  ⚠ Declared value is not effective in this context.
     Parent session permission mode takes precedence. [P2]
```

**Fork is a whole-configuration case, not a field.** Under `isFork` the agent's `tools`, `disallowedTools`, `mcpServers`, `model` and `permissionMode` are all inapplicable and the pool comes from the parent with enforcement `unknown` (§4.4 rule 1). Render one prominent statement for the context, not five identical field-level warnings.

**Never invent the effective value.** Where the resolver says `unknown` — an F8 substitute model's identity, for instance — show `unknown`, not a guess (§14, H1-29).

**Fact reference is part of the claim.** Each pair shows the fact id that governs it (P2, F8, F9, T3) the way the Why panel already does, so the statement is traceable.

## Acceptance

- [ ] `permissionMode` renders declared and effective side by side, with the P1/P2 reason when they differ
- [ ] A parent mode of `bypassPermissions` / `acceptEdits` / `auto` marks the declared value ineffective explicitly (P2)
- [ ] `model` shows both values under F8 when resolver reports model substitution; an unfounded substitute identity reads `unknown`
- [ ] **F8 deferral (orchestrator):** Regular `EffectiveConfiguration` has no F8 delta — `availableModels` exists only in managed-bundle overlay (`agent.modelAllowlist` fixture: `managed-simulation`). Matrix pins F8 to simulate `modelChanges`, not effective warnings. Acceptance #3 for model pairs in the regular effective UI is **deferred to P1-03** (F8 substitute-model honesty in simulation delta). V1-02 ships permissionMode, plugin fields, and fork; do not add resolver logic in this task.
- [ ] A plugin agent's `hooks`, `mcpServers` and `permissionMode` are marked ineffective with F9
- [ ] Selecting the `fork` preset states that the agent's configuration does not apply and why (T3)
- [ ] Nothing renders a pair for a field the resolver did not report on

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

If a case turns out not to be reported by the resolver at all, that is a finding, not a licence to compute it in the UI: record it and return it in the handoff.

**F8 finding (2026-08-31):** Model declared/effective pairs are not emitted on regular `EffectiveConfiguration`. F8 is gated to managed simulation (`resolveManagedModel`, `modelChanges`). Orchestrator deferred F8 UI to P1-03; V1-02 acceptance for the three resolver-backed cases (permissionMode, plugin fields, fork) is sufficient to close this task.
