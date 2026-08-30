# D1-03: S6 / S7 — evaluate rule arguments, or state why not

## Goal

Decide, with evidence, whether Capsight can report what an argument-scoped permission rule does to the capability set — and either implement it or record the refusal as a founded `unknown`.

## Spec refs

- SPEC §3.5 S6 (`Bash(cmd:*)` prefix matching), S7 (`Read`/`Edit` gitignore-like globs)
- SPEC §2.3 (no own permission engine), §6, §14
- `settings-permissions.ts` header: "not a permission engine"

## Scope IN

- `src/adapters/claude/resolution/settings-permissions.ts`
- `src/adapters/claude/version/matrix.ts` — `settings.bashPrefixRules`, `settings.pathRules`
- `tests/fixtures/claude/settings-permissions/`
- `docs/tasks/D1-03-rule-argument-semantics.md` — the decision, written back into Notes

## Scope OUT

- Deciding whether a specific command or path would be approved at runtime — that is the permission engine §2.3 forbids
- S8/S9/S10 (D1-02)

## Design decisions

**This task may legitimately end with no code.** The current entries say it plainly: *"The resolver does not evaluate rule arguments, so a path-scoped rule resolves unknown; a fixture pinning `/` vs `//` would need per-invocation resolution to assert against."* If that holds after investigation, the deliverable is a matrix note and a removed `pendingFixture`, not a forced implementation. §14 ranks honest unknowns above coverage.

**The distinction to establish first.** There are two different questions, and only one is in scope:

1. *Would `Bash(npm test)` be permitted?* — needs an invocation. Out of scope, forever (§2.3).
2. *Does `Bash(npm run test:*)` shrink or shape the reported Bash capability, and is `:*` recognized only at the end?* — a statement about rule shape, answerable without an invocation, and in scope.

If question 2 can be answered for a rule, the capability may carry a shaped status with its reason; if not, it stays `unknown` with the reason naming the limit.

**No new claim without a matrix entry.** Whatever is implemented is gated exactly like every other rule, and `[ext]`-confidence facts need a fixture before any confident conclusion uses them (M1 acceptance #9).

## Acceptance

- [ ] A written decision for S6 and for S7 separately: evaluated, or `unknown` with the reason
- [ ] Where evaluated: the rule is gated by its matrix entry, and a fixture makes it the operative cause of a non-`unknown` expectation
- [ ] Where not evaluated: `pendingFixture` removed, `notes` state what evidence would be required and why it is unavailable
- [ ] No code path decides whether a concrete command or path would be approved (§2.3 grep-level check)
- [ ] `unknownRate` for the fixture project changes only if a rule genuinely became determinate

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Inherited-confidence warning (from the D1-02 review)

`settings.webFetchRules` now carries `confidence: "fixture"`, earned by one edge only: an allow rule *without* the `domain:` prefix grants nothing. But the resolver routes three different shapes through that same matrix id (`settings-permissions.ts:144-145, 161`) — the prefix-less allow, the prefix-less deny, and the correctly prefixed `WebFetch(domain:...)`. The latter two resolve `unknown` today, so the shared id is harmless.

If this task makes a prefixed WebFetch rule confident, it would **inherit fixture-level confidence through an entry that never pinned it**. Split the entry before making any such rule confident, or the promotion is unearned.

## Notes

This is the task most likely to be "solved" by writing plausible glob matching that nothing founds. Resist it: an invented semantics that agrees with intuition is the exact failure mode §14 is written against.

## Decision (D1-03, implemented)

Both questions were asked in the form the handoff requires — not "would this command
be permitted" (§2.3, out of scope forever) but "does the rule shrink or shape the
reported capability, and is the shape itself decidable". Both answers are *no*, so
this task ships no production code: two matrix entries move from `pendingFixture` to
`noFixturePossible`.

**S6 — `Bash(cmd:*)` prefix matching: `unknown`.** Both halves of S6 answer a
per-invocation question. The prefix decides which command lines match; the position of
`:*` decides where the wildcard applies. Neither half states what a `Bash(...)` rule
leaves of the capability set, so the rule resolves `unknown` in either action and no
golden value can rest on it. The tempting move — treating a mid-pattern `:*` the way
S8's missing `domain:` prefix is treated, i.e. as an allow that grants nothing — is
refused: S8 says the prefix is *required*, which makes a rule without it malformed,
whereas S6 says only that `:*` is not a wildcard away from the end. A rule with a
mid-pattern `:*` is still a rule; calling it inert would be invented semantics.
Separately, no rule in the corpus even reaches this entry today: both fixture `Bash(...)`
entries are inert behind the bare `Bash` deny and are attributed to
`settings.denyPrecedence`.

**S7 — `Read`/`Edit` gitignore-like globs: `unknown`.** S7 says which paths a rule
covers (`/` = project root, `//` = filesystem root). Matching a concrete path against
that glob is precisely the per-invocation decision §2.3 forbids. The fixture already
carries both anchoring forms — allow `Read(/src/**)`, deny `Edit(//etc/secrets/**)` —
and both resolve `unknown`/`unknown` through `settings.pathRules`; that is the entry's
whole claim and it is not promotable.

**Considered and rejected:** lowering the tool-level `Read`/`Edit`/`Bash` capability to
`unknown` because *some* path or command is denied. S7/S6 say which invocations a rule
covers, not what survives of the tool, so that would trade a founded verdict for an
unfounded one and raise `unknownRate` on no evidence.

**Not touched:** `settings.webFetchRules` was not split, because nothing here made any
WebFetch shape confident; the inherited-confidence hazard the review named is unchanged
and still applies to whoever does promote a prefixed `WebFetch(domain:...)` rule.

Coverage is unchanged (92 / 0 / 9 / 31 / 52) — correctly: no fact became
fixture-verified. `pendingFixture` count 8 -> 6.
