# D1-08: Codex matrix and fixture depth

## Goal

Do for the Codex adapter what D1-07 does for Cursor: found the answers the product already shows.

## Spec refs

- `docs/CODEX-FACTS.md` (XV, XR, XI, XS, XM, XSet, XT families)
- SPEC §8.1–§8.2, §11.1–§11.4, §6

## Scope IN

- `docs/CODEX-FACTS.md`
- `src/adapters/codex/version/facts.ts`, `version/matrix.ts`
- `src/adapters/codex/resolution/`
- `tests/fixtures/codex/` — new fixture directories beyond `basic`
- `tests/fixtures/run-codex-golden.test.ts`

## Scope OUT

- Claude and Cursor adapters
- Installing the Codex CLI as a test dependency — the corpus stays file-based

## Design decisions

**Codex has the better-documented precedence chain of the two new platforms.** `CODEX-FACTS.md` §3 lists six ranked layers `[doc]`, and the `AGENTS.md` / `AGENTS.override.md` pair with its root→cwd walk is documented per-directory. Precedence and instruction assembly are therefore the highest-confidence targets, unlike Cursor where discovery rules came first.

**The trust gate is real here and must be exercised.** Untrusted projects skip project `.codex/` layers while user and system config still load (`CODEX-FACTS.md` §2.2). A fixture pinning trusted versus untrusted resolution is the single most valuable case in this task — and per §2.4 the wording stays "project layers are not loaded", never "the project is sandboxed".

**XV2 stays honest.** The CLI is not installed on the development machine; version detection is `[spike]` and degraded mode must keep working. No fixture may require `codex` on PATH (H1-22 hermeticity).

**Workspace boundary asymmetry is already documented** (commit `f6a47ac`, XR4) and is a good candidate for a founded entry.

## Acceptance

- [x] At least three Codex matrix entries reach a non-`unknown` status, each founded on a `CODEX-FACTS.md` entry (`instruction.chain`, `instruction.ancestors`, `trust.project`)
- [x] At least two fixtures beyond `basic`, one of which pins the trusted-versus-untrusted difference (`trust-untrusted`, `agents-precedence`, `nested-instructions`)
- [x] `AGENTS.md` / `AGENTS.override.md` precedence is founded and pinned (`agents-precedence`, XI1)
- [x] No fixture requires the Codex CLI on PATH; degraded version detection stays covered
- [x] Codex coverage report (D1-01) shows a recorded, non-zero fixture-verified count (2: XI1, XT1)
- [x] Trust wording carries no security-boundary claim (§2.4)

## Done checklist

- [x] `npm run test` passes (codex+cursor: 52/52; full suite has pre-existing env failures on dev machine)
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)

## Notes

Review: pass with findings → fixed. `instruction.ancestors` downgraded to `confidence: "doc"` (ancestor walk not matrix-gated; H1-28). Fixture `nested-instructions` pins XR4 discovery behavior; matrix entry is supported/doc-backed.
