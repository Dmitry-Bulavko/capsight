# D1-07: Cursor matrix and fixture depth

## Goal

Raise the Cursor adapter from three matrix entries — all `status: "unknown"` — and a single `basic` fixture to a corpus that founds the answers the UI already displays.

## Spec refs

- `docs/CURSOR-FACTS.md` (CV, CW, CA, CS, CR, CM, CSet, CT families)
- SPEC §8.1–§8.2, §11.1–§11.4, §6

## Scope IN

- `docs/CURSOR-FACTS.md` — promote or add facts as evidence is established
- `src/adapters/cursor/version/facts.ts`, `version/matrix.ts`
- `src/adapters/cursor/resolution/`
- `tests/fixtures/cursor/` — new fixture directories beyond `basic`
- `tests/fixtures/run-cursor-golden.test.ts`

## Scope OUT

- Claude adapter changes
- Cross-platform compatibility claims (that is EC-01, and it depends on this task)

## Design decisions

**The current state, stated plainly:** every one of the three matrix entries has `status: "unknown"`, so `resolveEnforcement` returns `unknown` for everything and the adapter's confident surface is empty. The UI shows Cursor projects; it currently answers almost nothing about them.

**Priority order follows what the UI already claims to show:** agent discovery and collisions (CA3/CA4/CW4) → rules and skills discovery (CS/CR) → MCP (CM) → settings layers (CSet). Trust (CT1) stays `unknown`: `CURSOR-FACTS.md` records no trust record equivalent, and inventing one would be the worst kind of false confidence.

**`.mdc` versus `.md` is the highest-value single rule.** A plain `.md` in `.cursor/rules/` is ignored by Cursor — a project can have rules that silently do nothing. That is exactly the class of finding the product exists to surface, and it is `[doc]`-founded today.

**Do not mirror Claude's rules by analogy.** `collision.sameDir` already carries the note "mirror Claude A4 pattern; winner rule unverified". Cursor's behaviour is Cursor's; an analogy is not evidence.

## Acceptance

- [x] At least three Cursor matrix entries reach a non-`unknown` status, each founded on a `CURSOR-FACTS.md` entry
- [x] At least two fixtures beyond `basic`, exercising rules/skills discovery and an agent collision
- [x] The `.mdc` versus `.md` rule is founded and produces a visible warning on a project that has a plain `.md` in `.cursor/rules/`
- [x] `CT1` (trust) remains `unknown` with its reason intact
- [x] Cursor coverage report (D1-01) shows a recorded, non-zero fixture-verified count (3: CR4, CA2, CA3)
- [x] Golden runner fails loudly on mismatch — no fail-open (H1-07)

## Done checklist

- [x] `npm run test` passes (cursor-specific: 67/67; full suite failures pre-existing on dev machine — 21 baseline vs 18 with D1-07)
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)

## Notes

Review: pass with findings. H1-28 deletion tests pass for all three fixture entries. CW4 shadowing inherits collision gate without fixture — latent only.
