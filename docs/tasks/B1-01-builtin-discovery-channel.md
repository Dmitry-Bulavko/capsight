# B1-01: Synthetic builtin inventory in discovery

## Goal

Add a discovery channel that emits Claude's six built-in agents (B1) so B4 user-over-builtin override can be fixture-tested or honestly refused with a narrower reason.

## Spec refs

- SPEC §3.9 (B1, B4)
- SPEC §11.1–§11.4
- H1-28
- D3-03: `discovery.builtinInventory` and `discovery.builtinNameOverride` are `noFixturePossible` because discovery does not synthesize builtins

## Scope IN

- `src/adapters/claude/discovery/agents.ts` (or dedicated `builtins.ts` under discovery/)
- `src/adapters/claude/version/matrix.ts` — `discovery.builtinInventory`, `discovery.builtinNameOverride`
- `tests/fixtures/claude/` — new or extended fixture (e.g. `builtin-agents/` or extend `basic/`)
- `tests/fixtures/coverage-report.test.ts` — only if B1/B4 disposition changes
- `docs/EVIDENCE-LEDGER.md` — if unverified count or disposition changes

## Scope OUT

- Cursor/Codex builtin semantics (Claude-only)
- Resolving builtin tool pools beyond what B2 already gates
- UI
- §9 observed runtime behavior

## Design decisions

**Minimum viable channel:** Discovery output includes synthetic records for Explore, Plan, and other B1-named builtins with stable ids, `source: builtin` (or equivalent), and scope that distinguishes them from file-backed agents.

**B4 fixture:** A user agent named `Explore` in the fixture must produce a collision/override record referencing the synthetic builtin — or matrix documents why still unpromotable after the channel exists.

**Do not** write to scanned user project's `.claude/**`.

## Acceptance

- [ ] Discovery lists B1 builtins as synthetic agents (count and names match fact registry)
- [ ] B1 matrix entry updated: fixture evidence or refined `noFixturePossible` reason
- [ ] B4 matrix entry updated: fixture pins override OR honest refusal with channel present
- [ ] H1-28 deletion test where promotable
- [ ] D4-06 gate unchanged unless ledger explicitly updated
- [ ] `npm run test` and `npm run typecheck` pass

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)
