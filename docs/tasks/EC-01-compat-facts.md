# EC-01: Cross-platform compatibility facts corpus

## Goal

Establish a documented, version-gated corpus stating, for each resource class, which platforms consume it — so the ecosystem screen can render a compatibility badge without ever asserting an unfounded platform claim.

## Spec refs

- SPEC §3 (Verified Platform Facts — resolver may rely only on documented facts)
- SPEC §6 (enforcement classification), §8.1–§8.2 (matrix model and rules)
- SPEC §2.4 (language of claims), §13 invariant 3
- Existing corpora: `docs/CURSOR-FACTS.md`, `docs/CODEX-FACTS.md`

## Scope IN

- `docs/COMPAT-FACTS.md` — new corpus (IDs `EC1`…, trust levels `[doc]` / `[ext]` / `[spike]`)
- `src/core/compat/resource-class.ts` — platform-neutral resource-class identifiers
- `src/core/compat/matrix.ts` — `lookupCompat(resourceClass, platform)` → `{ support, enforcement, matrixRef, reason }`
- `src/adapters/{claude,cursor,codex}/version/matrix.ts` — entries backing each `supported` / `not-supported` verdict
- `tests/core/compat/matrix.test.ts`

## Scope OUT

- Any UI (EC-04, EC-05)
- Scanning or merging (EC-02)
- New platform adapters

## Design decisions

**Three-valued support, never two.**

```ts
type CompatSupport = "supported" | "not-supported" | "unknown";
```

`unknown` is the default and is expected to be the majority verdict at v1. A verdict other than `unknown` requires a matrix entry gated on the detected platform version, exactly like every other product claim (§8.2). A missing or unsupported entry degrades the verdict to `unknown` — it never falls back to `not-supported`.

**Resource class, not file guess.** A verdict is stated about a class (`skill@.cursor/skills`, `instruction@AGENTS.md`, `agent@.claude/agents`, `mcp@.cursor/mcp.json`, …), not about an individual discovered file. The inventory maps each resource to exactly one class.

**Shared artifacts are first-class.** `AGENTS.md` is consumed by both Cursor and Codex (`CURSOR-FACTS.md` §2.1, `CODEX-FACTS.md` §2.2). The corpus must express many-to-many consumption, not a one-platform-per-path assumption.

**Wording follows §2.4.** A `not-supported` verdict reads `"Cursor does not read this path"`, never `"this will not work"`.

## Acceptance

- [ ] `docs/COMPAT-FACTS.md` exists: one row per (resource class × platform) with statement, trust level and source link
- [ ] Every class discovered by any of the three adapters appears in the corpus
- [ ] `AGENTS.md` is recorded as consumed by Cursor and Codex, with both source references
- [ ] `lookupCompat` returns `unknown` whenever no matrix entry is founded on the detected version — never `not-supported`
- [ ] Every `supported` / `not-supported` verdict carries a `matrixRef` resolving to a real entry
- [ ] Test asserts no verdict escapes the gate: for a synthetic unknown version, all verdicts collapse to `unknown`
- [ ] `src/core/` gains no platform-specific path literal (invariant 1) — path patterns stay in adapters, classes stay neutral

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

This task ships before any pixel of the ecosystem screen deliberately. The badge is the one element of the feature that makes a claim about platform behaviour; if it is built from intuition rather than the corpus, the screen becomes exactly the confident-and-wrong UI that SPEC §14 exists to prevent.
