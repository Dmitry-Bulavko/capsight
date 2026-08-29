# H1-05: facts.ts — real fact registry with trust levels

## Goal

`facts.ts` models §3 as data — id, section, statement, trust level — instead of bare string constants, so `[doc]` / `[ext]` / `[spike]` becomes machine-checkable.

## Spec refs

- SPEC §3 (all fact tables; trust levels `[doc]`, `[ext]`, `[spike]`)
- SPEC §0.1.1 (не угадывать семантику платформы)
- SPEC §8.2

## Scope IN

- src/adapters/claude/version/facts.ts
- src/adapters/claude/version/matrix.ts (`factRefs` typing)
- call sites currently using inline fact-id string literals
- tests/adapters/claude/version/matrix.test.ts

## Scope OUT

- Implementing the behaviour of newly registered facts (S1–S11, K8/K10–K12 stay unimplemented)
- Changing enforcement wiring — H1-04

## Findings being fixed

`facts.ts` is 42 lines of bare constants (`export const F2 = "F2"`) plus `M1_DOC_FACTS`. It carries no statement text, no source, and **no trust level** — the `[doc]`/`[ext]`/`[spike]` axis is not modeled anywhere in the codebase. 12 of ~83 §3 facts are registered; the rest appear as inline string literals: A3/A4 (`discovery/agents.ts:227,259`), A10 (`description-budget.ts:72`), F8 (`application/simulate.ts:43,168`), F9 (`resolution/resolver.ts:363`, `plugin.ts:80`), S4 (`security-findings.ts:196`), K1/K4/K6 (`skills.ts:104,122`, `security-findings.ts:151`), R1/R4/R5 (`trust.ts:128,137,162,173,233`), I1 (`resolver.ts:267`), B2 (`resolver.ts:197`).

## Acceptance

- [ ] Every §3 fact used anywhere in `src/` is registered with `{ id, section, statement, confidence: "doc" | "ext" | "spike" }`
- [ ] Trust levels match the §3 tables exactly — spot-checked by a test over the `[ext]` set (S1–S11, K8, K10–K12, §3.11 `env` block)
- [ ] No inline fact-id string literal remains in `src/` outside `version/facts.ts` (grep-asserted by a test)
- [ ] `matrixRef` / `factRefs` are typed against the registry, so an unregistered id fails typecheck
- [ ] Facts not yet implemented may be registered; registration alone must not make anything `enforced`

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Registering all of §3 also fixes the §11.4 denominator (H1-08) — keep the registry the single source for both.

## Orchestrator verification (post-implementation)

Cross-checked the registry against the SPEC tables mechanically (parse §3 rows → compare id and trust level to `facts.ts`):

```
facts in SPEC tables: 83   facts in registry: 92 (83 + E1–E9 from §3.11)
missing from code: none
confidence mismatches: none
ext facts: E9, K8, K10, K11, K12, S1–S8, S10, S11  (15)
```

S4 stayed `ext` despite `security-findings.ts` relying on it — exactly the upgrade this task existed to prevent. Accepted.

**§3.11 id convention accepted:** `E1`–`E9` in table order, with the variable name stored in an `envVar` field so the id is anchored to the variable rather than to the row position.

**Left open deliberately:** `core/model`'s `matrixRef` stays `string` rather than `FactId`, because `src/core/` must not import from `src/adapters/claude/` (invariant 1). Typing is enforced at the adapter boundary, where every fact reference is produced. H1-12 may revisit this once the core/adapter split is cleaned up.
