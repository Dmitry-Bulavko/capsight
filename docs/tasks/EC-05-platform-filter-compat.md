# EC-05: Platform filter and three-valued compatibility badges

## Goal

Let the viewer switch which agentic platform the canvas is read against, and mark every resource as consumed, not consumed, or unknown for each platform — with the verdict always traceable to a fact.

## Spec refs

- SPEC §6 (enforcement), §8.2 (gating), §2.4 (language of claims), §14 (honest unknowns)
- `docs/COMPAT-FACTS.md` (EC-01)

## Scope IN

- `src/ui/components/PlatformFilter.tsx`
- `src/ui/components/CompatBadges.tsx`
- `src/ui/ecosystem-layout.ts` — filtered layout
- `src/ui/styles.css`
- `tests/ui/compat-badges.test.ts`, `tests/ui/platform-filter.test.ts`

## Scope OUT

- The corpus itself (EC-01)
- Detail panel content (EC-06)

## Design decisions

**Three icon states, never two.** `supported`, `not-supported`, `unknown` — with `unknown` visually neutral, not a warning. It is the absence of a claim, not a defect (§6).

**Every badge is traceable.** A badge is clickable and reveals the fact ID, trust level and the sentence behind the verdict. A badge with no fact behind it cannot be rendered as anything but `unknown`.

**Filter semantics are additive, not destructive.** Selecting a platform dims resources that platform does not consume rather than removing them — the value in the assessment case is seeing *what would not carry over*, which deleting the nodes destroys. An **All platforms** state is the default.

**Not-detected platforms are selectable.** Choosing one answers "what does this project have if we adopt it", the direct form of the assessment question.

**Wording.** `"Claude Code does not read .cursor/skills"` — never `"will not work"`, never `"broken"` (§2.4).

## Acceptance

- [ ] Filter lists all three platforms plus **All**; not-detected platforms are selectable and marked as not detected
- [ ] Each resource node shows one badge per platform in the three-valued scheme
- [ ] Clicking a badge reveals fact ID, trust level and statement; a verdict with no matrix entry always renders `unknown`
- [ ] Selecting a platform dims rather than removes non-consumed resources; counts state how many are dimmed
- [ ] With a synthetic unknown platform version, every badge renders `unknown` and none renders `not-supported`
- [ ] No badge copy asserts capability or breakage (§2.4 wording test)

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

Expect most badges to read `unknown` at v1. That is the honest state of the corpus and it is the product's differentiator, not a gap to paper over before the demo.
