# Continuation notes — D1 phase

Written at `969d327` on `claude/d1-depth-evidence`. Delete this file when the phase closes.

Contract: [SPEC.md](./SPEC.md) · Phase status: [ROADMAP.md](./ROADMAP.md) · Backlog: [TASKS.md](./TASKS.md) · Workflow: [DEVELOPMENT.md](./DEVELOPMENT.md)

## Where things stand

| | |
|---|---|
| Branch | `claude/d1-depth-evidence`, pushed, local == remote |
| Suite | 558 tests / 57 files green; `npm run typecheck` clean |
| Claude coverage | **92 / 0 runtime / 11 fixture-verified / 34 documentation-only / 47 unverified** |
| Cursor coverage | 26 / 0 / 0 / 4 / 22 |
| Codex coverage | 25 / 0 / 0 / 4 / 21 |
| `pendingFixture` | **0** — every one of the 44 Claude matrix entries is resolved |
| Corpus | 20 fixture directories (§11.1 fixes this; a test enforces it) |

Done: D1-00, D1-01, D1-09, D1-10 (scaffolding) and D1-02 … D1-06 (evidence).

## D1-06 is closed

Its review returned `pass with findings` after these notes were first written. Both promotions were reproduced by the reviewer under the literal deletion test and both hold; `verifiedFacts: [F9]` and `[K4]` are earned. The re-record was clean — `trust-inline-mcp/expected.json` has zero deleted lines and `skills-preload/expected.json`'s only deletion is a comma. B2's pointer move to `instructions` was judged sound reuse rather than fixture shopping: that fixture already carried the explore and plan presets.

Three findings came out of it and are recorded as tasks rather than fixed: **D1-15** (A10's refusal overstates its obstacle, and there is no golden channel for snapshot-level warnings at all), **D1-16** (`agent-hooks` normalizes to `instruction:<path>` and can collide), and a one-line correction already applied to `docs/tasks/H1-28-fixture-confidence-meaning.md`.

## Next work, in order

1. **D1-07 — Cursor depth.** Not started.
2. **D1-08 — Codex depth.** Not started.
3. **D1-13** — the `documentation-only` tier does not consult `factConfidence`. Worth doing before quoting the metric anywhere public; see the caveat in ROADMAP.
4. **D1-14** — a `skills:` entry resolving to a command file reports `preloaded` on K1's authority. Pre-existing, reproduced against `origin/main`.
5. **D1-11, D1-12** — deferred, not golden-observable today.

Then the **EC** phase (8 tasks, `blocked`) unblocks once D1-07 and D1-08 land.

### The trap waiting in D1-07 and D1-08

Cursor and Codex sit at **0 fixture-verified for a structural reason, not a thin corpus**: their `FeatureCompatibility` interfaces carry no `verifiedFacts` field, and every entry is `status: "unknown"` / `confidence: "doc"`. `entryFactCoverageTier` therefore cannot lift them above `documentation-only` however many fixtures are added. Adding that field is the first move in either task; writing fixtures first accomplishes nothing measurable.

## How the loop runs

Orchestrator → implementer → **reviewer** → orchestrator verifies → mark done. Exactly one task `in_progress`. Roles: `.claude/agents/implementer.md`, `.claude/agents/reviewer.md` (and `.cursor/skills/` twins).

The reviewer is a different agent from the implementer on purpose. It has earned its place: it failed D1-01 on an acceptance item, failed D1-10 by reproducing a defect in the live working tree that the implementer's own checks and a first review had both passed, and caught a near-vacuous invariant in D1-02. Do not let one agent both write and review.

**Orchestrator does the docs.** `ROADMAP.md` and `TASKS.md` are never in an implementer's scope — D1-01 failed review precisely because its handoff put ROADMAP in Scope IN while the delegation forbade touching it.

## Operational rules learned the hard way

- **Never pipe vitest output through `head` or `grep`.** SIGPIPE kills the run before teardown and leaves stale lease claims in every fixture marker. Redirect to a file, then grep the file. This is how the D1-10 defect was created in the first place.
- **After any run**, confirm `find tests/fixtures -maxdepth 4 -name .git -type d` and `-path '*/project/.git/*' -type f` are both empty, and `git status` is clean.
- **The deletion test is a run, not a prediction.** Delete the rule, re-run, confirm a **non-`unknown`** value moves in the golden, restore. D1-05 wrote a predicted outcome into a note and the observed behaviour differed.
- **`verifiedFacts` stays empty unless the fixture exercises the fact entire.** Four of the six promotions in this phase carry `[]`. That is the expected shape.
- **A refusal is a first-class deliverable.** Eight entries now carry `noFixturePossible`. Its reason must say whether the impossibility is structural (nothing in the model can carry the verdict) or a consequence of the permanent §2.3 scope choice.
- **Every matrix entry declares exactly one** of `fixture` / `pendingFixture` / `noFixturePossible`, asserted over all 44.
- **No new fixture directories.** Extend the existing 20.

### Printing the coverage report

There is no CLI for it. Write a throwaway test, run it, delete it:

```ts
// tests/zz-cov.test.ts
import { it } from "vitest";
import fs from "node:fs";
import { buildCoverageReport, formatCoverageReport, platformFixturesRoot } from "./fixtures/coverage-report.js";
import { FACTS } from "../src/adapters/claude/version/facts.js";
import { VERSION_MATRIX } from "../src/adapters/claude/version/matrix.js";
it("prints coverage", () => {
  const root = platformFixturesRoot("claude");
  const names = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  console.log(formatCoverageReport(buildCoverageReport(FACTS, VERSION_MATRIX, names), "claude"));
});
```

## What to expect, honestly

The metric moves far more slowly than the work behind it. Twelve `pendingFixture` debts were resolved this phase; **eight of them were refusals** — debts that can never be paid rather than debts not yet paid. `fixture-verified` moved 9 → 11 and `unverified` 52 → 47.

The original estimate of 9 → ~20 was wrong. A realistic finish for D1 is 11–14, most of it from D1-07 and D1-08 once their adapters can record evidence at all.

That ratio is the phase working, not failing: it exists to find out what cannot be proved, not only to prove things.

### One process note

Twice in this phase the orchestrator marked a task `in_progress` and said it was launching an implementer without actually doing so (D1-03, D1-06). Before ending a turn, check that any task marked `in_progress` has a live agent behind it.
