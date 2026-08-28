# H1-24: CLI and API disagree on the default execution context

## Goal

One default context, defined once, with the §4.3 caption, on every surface.

## Spec refs

- SPEC §4.3 (Дефолт в UI — `background-subagent`, потому что это фактический режим по умолчанию (T6). Рядом обязательна подпись, почему выбран именно он)
- SPEC T6
- SPEC §4.1 (показывать результат без указания контекста запрещено)

## Scope IN

- src/server/routes/agents.ts (the `/:id/effective` and `/:id/explain` routes)
- src/server/routes/graph.ts and any other route taking `?context=`
- src/cli/index.ts (`CONTEXT_PRESETS`, `DEFAULT_CONTEXT_PRESET`, `DEFAULT_CONTEXT_REASON`)
- a shared module for the preset list, the default and its caption

## Scope OUT

- Changing what any preset resolves to
- The UI's own default, if it already follows §4.3

## Finding

The HTTP routes default to `main-session`:

```ts
getQueryString(req.query.context) ?? ("main-session" satisfies ContextPreset)
```

while H1-14 gave the CLI `background-subagent` with the T6 caption, as §4.3 requires. So `agent-manager explain X --agent a` and `GET /api/capabilities/X/explain?agent=a` answer the same question differently, and the API's answer is the one §4.3 contradicts. `main-session` is also the most permissive preset — F5, F10 and M5 all apply there — so the API's default flatters the configuration relative to what actually happens in an interactive session.

`CONTEXT_PRESETS` and `PERMISSION_MODES` are now duplicated between the CLI and the routers, which is how the two drifted in the first place.

## Acceptance

- [ ] The preset list, the default preset and the caption live in one module both surfaces import
- [ ] Every surface defaults to `background-subagent`
- [ ] Every surface that applied a default says so, with the T6 caption — never a bare result (§4.1)
- [ ] An unrecognized preset is rejected with the list of valid presets, not silently defaulted
- [ ] The UI is checked against the same rule and follows it

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Raised by H1-14, which correctly implemented the spec on its own surface and flagged the divergence rather than silently matching the API's wrong default.
