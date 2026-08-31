# S9-01: S0 revisit — API maturity assessment

## Goal

Re-evaluate whether Claude Code platform APIs now satisfy S0-DECISION revisit criteria; produce an updated go/no-go/partial decision before any observed-layer product code.

## Spec refs

- SPEC §9.1–§9.5
- S0-DECISION.md revisit criteria (post–v0.1)

## Scope IN

- Documentation review: Agent SDK (`@anthropic-ai/claude-agent-sdk`), SubagentStart hook, PreToolUse hook, `claude -p --debug` (docs only unless dev probe justified)
- Prior findings: `docs/tasks/S0-01-findings.md` … `S0-04-findings.md`, `src/adapters/claude/probing/*`
- Output: `docs/S9-DECISION.md` (new) with explicit verdict: **full observed layer** | **invocation-only partial** | **remain deferred**
- Update `docs/S0-DECISION.md` with short "Revisit (S9-01)" addendum linking to S9-DECISION.md

## Scope OUT

- Product wiring (`ObservedCapability` pipeline, scan-path probes, UI)
- Cursor/Codex observed layer
- Live fixture probes unless clearly justified and documented as optional dev-only per §9.4

## Acceptance

- [x] All four S0 revisit criteria from S0-DECISION assessed with dated evidence
- [x] Verdict is one of: full / invocation-only partial / remain deferred — with rationale
- [x] If remain deferred: list what would need to change for next revisit
- [x] If go (full or partial): recommend ordered S9-02+ task breakdown (titles only, no implementation)
- [x] `npm run test` and `npm run typecheck` pass (doc-only expected)

## Done checklist

- [x] `npm run test` passes
- [x] `npm run typecheck` passes
- [x] No writes to scanned project's `.claude/**`
- [x] TASKS.md updated by orchestrator (not implementer)

## Notes

Baseline: S0 (2026-08-28) concluded **observed-layer: no** — no structural resolved tool pool API. D5 closed with 18 unverified facts whose honest ceiling depends on §9 or new platform facts.
