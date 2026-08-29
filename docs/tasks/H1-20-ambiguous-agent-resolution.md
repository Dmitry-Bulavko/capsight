# H1-20: Resolving an ambiguous or shadowed agent must not be silent

## Goal

An agent whose discovery status is `ambiguous` or `invalid` cannot be resolved as if it were a settled configuration.

## Spec refs

- SPEC A4 (следствие: резолвер обязан помечать случай как `ambiguous` и не выбирать победителя)
- SPEC §5 (`Warning.category` includes `"ambiguous-collision"`)
- SPEC §13 invariants 3, 4, 14

## Scope IN

- src/adapters/claude/resolution/resolver.ts (agent lookup and warning emission)
- src/adapters/claude/discovery/agents.ts (only if the status needs surfacing differently)
- tests/fixtures/claude/collision-same-dir/contexts.json (point it at the ambiguous agent once the behaviour is defined)
- tests covering the new warning

## Scope OUT

- Changing how collisions are detected — discovery is correct (A1/A3/A4 verified by H1-09)
- Choosing a winner for A4 — the whole point is that there is none

## Finding

Discovery correctly marks both colliding files `status: "ambiguous"` with two candidates and no `collision.effective`. The resolver then ignores `agent.status` entirely: resolving that name by id returns one candidate's configuration as a settled answer, with no warning. `Warning.category` already declares `"ambiguous-collision"` and nothing in `src/` ever emits it.

This is the §0.1.2 failure mode one layer up from the tool pool: discovery knows it does not know which file wins, and resolution presents one of them as fact. Found while authoring the H1-09 fixtures; `collision-same-dir/contexts.json` was deliberately pointed at an unambiguous agent so the silence would not be blessed in a golden file.

## Acceptance

- [ ] Resolving an `ambiguous` agent emits an `"ambiguous-collision"` warning naming both candidate files
- [ ] Capabilities derived from a contested frontmatter field resolve `unknown` / `enforcement: "unknown"` — the product must not present one candidate's `tools` as the effective set
- [ ] Capabilities that both candidates agree on may stay confident, with the agreement stated as the reason
- [ ] Resolving an `invalid` agent (A7) is refused or resolves entirely `unknown`, never as if the file had loaded
- [ ] `shadowed` agents keep resolving via the winner, with the shadowing recorded as a reason — A3 does define a winner
- [ ] `collision-same-dir/contexts.json` is repointed at the ambiguous agent and its golden records the above

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Raised by the H1-09 implementation. Rank this with the blocker-class tasks rather than the debt ones: it is a confident wrong answer, not missing coverage.

## Orchestrator verification (post-implementation)

The regenerated golden carries both resolutions, so the rule and its contrast sit in one file:

| agent | capability | verdict | reasons |
|---|---|---|---|
| `planner` (unambiguous) | `Read` | available / enforced | declared |
| | `Grep` | denied / enforced | denied |
| | — | unknownRate 0, no warnings | |
| `reviewer` (ambiguous) | `Read` | unknown / unknown, 2 sources | denied, **ambiguous** |
| | `Grep` | unknown / unknown, 2 sources | declared, **ambiguous** |
| | `permission:default` | available / enforced | inherited, **declared** (agreement) |
| | — | unknownRate 0.967, one `ambiguous-collision` warning naming both files | |

The interesting half was implemented rather than shortcut: the candidates disagree on `tools`, so those capabilities go undetermined, while they agree on `permissionMode`, so that one stays confident with the agreement stated as its reason. Suite 425 passed | 1 todo. Accepted.

**Two decisions worth ratifying.**

Agreement is deliberately not run through `gateCapability`. `agent.collisionSameDir` is `status: "unknown"` by construction, so gating an agreed field would collapse exactly the half this task exists to preserve. The agreement is a fact about the two files in front of us, not a claim about platform behaviour, so it needs no version gate.

The parent tool pool is now the union over candidates. Otherwise the enumerated set of tools would depend on which candidate file we happened to read first — the same silent pick this task is about, one level down.

**Beyond the ambiguous case, two adjacent silences closed.** A `shadowed` agent previously resolved the *loser's* own frontmatter, which never loads; it now resolves through the winner with the shadowing recorded. An `invalid` agent (A7) previously resolved its empty configuration as a fully inherited tool pool — the unparsed file reading as "no restrictions". It now returns no capabilities, `unknownRate: 1`, and a warning.

**Convention accepted:** candidate paths live in `sources` and `evidence`, never interpolated into message text. No other message in `src/` embeds a path, and doing so would have made the golden machine-specific.

**Appended to H1-22:** the golden runner resolves a fixture agent by name, and an A4 collision has two entries under one name, so it takes the first. Status and enforcement no longer depend on that pick, but `sources` ordering still does.
