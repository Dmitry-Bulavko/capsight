# H1-06: Matrix entries for rules that already emit `enforced`

## Goal

Every resolver rule that produces a confident verdict has a version-matrix entry with a populated fixture, per §0.1.3.

## Spec refs

- SPEC §0.1.3 (правило без фикстуры не мержится)
- SPEC §8.1, §8.2
- SPEC §13 invariant 11

## Scope IN

- src/adapters/claude/version/matrix.ts
- tests/adapters/claude/version/matrix.test.ts

## Scope OUT

- Writing the fixtures themselves — H1-09, H1-10, H1-11
- Enforcement wiring — H1-04

## Findings being fixed

The matrix holds 11 entries. Rules that emit `enforcement: "enforced"` with **no matrix entry at all**: trust R1/R4/R5 (`resolution/trust.ts`, `resolver.ts:309-311`), skills K1/K4/K5 (`skills.ts:115`), instructions I1 (`resolver.ts:267`), builtin read-only B2 (`resolver.ts:197`), plugin field limits F9 (`resolver.ts:363`, `plugin.ts:80`), model allowlist F8 (`simulate.ts:168`), description budget A10, collisions A3/A4. Separately, `agent.depthLimit` declares `fixture: "depth-limit"` while that directory is `.gitkeep`-only — merged against §0.1.3.

## Acceptance

- [ ] Each rule listed above has a matrix entry with `id`, `factRefs`, `minVersion`, `status`, `confidence`, `fixture`
- [ ] No matrix entry names a fixture directory that lacks `expected.json` — asserted by a test (this covers `agent.depthLimit`)
- [ ] Entries whose fixture is not yet written are `confidence: "doc"` and, per H1-04, cannot back an `[ext]` fact
- [ ] N5 historical depth values (2.1.172–2.1.216 = 5, 2.1.217–2.1.218 = 1, 2.1.219+ = 3) are represented via `changedIn`

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Ordering: H1-05 (facts) → this task (matrix) → H1-04 (wiring) → fixtures. The fixture-existence assertion here is what makes H1-09..H1-11 non-optional.

## Orchestrator verification (post-implementation)

Matrix grew from 11 to 23 entries. Verified by dumping every entry's status and fixture state:

- 11 entries carry a real `fixture` whose `expected.json` exists;
- 12 carry `pendingFixture` and claim no evidence — including `agent.depthLimit`, whose false `fixture: "depth-limit"` was the §0.1.3 breach this task targeted;
- `agent.collisionSameDir` is `status: "unknown"`, not `supported` — A4 documents only that a single file loads, never which one wins, so the entry does not pretend otherwise.

**Design choice accepted:** `fixture` xor `pendingFixture` on the record itself, rather than a central pending list. The claim and its rebuttal live on the same line, a fixture-writing task flips one field, and the test can assert "exactly one of the two" instead of cross-checking a list that drifts. `pendingFixture` intentionally does not require the directory to be complete — it also covers a directory that exists but lacks the case for this rule (`trust.frontmatterHooks` → `trust-inline-mcp`, `builtin.readOnly` → `tools-filters`).

**Follow-through for H1-09..H1-11:** each of those tasks must flip the `pendingFixture` entries it satisfies to `fixture`, and H1-04 must treat a `pendingFixture` entry as evidence-free.
