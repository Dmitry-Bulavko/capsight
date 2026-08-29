# P1-01: Platform switcher, and Cursor + Codex as second and third adapters

## Goal

The product inspects more than one agent system: a `PlatformAdapter` port that `application/` depends on instead of `adapters/claude/`, a platform switch on every surface, and Cursor and Codex adapters behind it.

## Spec refs

- SPEC §12.2 (structure), §13 inv 1 (Claude specifics only in `src/adapters/claude/`)
- SPEC §3 (Verified Platform Facts — the layer a resolver may rely on)
- SPEC §8.1, §8.2 (confidence, version matrix), §11.4 (coverage metric)
- SPEC §2.3 (Non-goals — multi-platform is *not* listed there, but nor is it in scope anywhere else; see Notes)
- SPEC §13 inv 4, 14 (`unknown` never becomes `allow`/`deny`; a confidently wrong answer is worse than a missing feature)

## Scope IN

Stage A — port and switcher (Claude only, no behaviour change):
- New: `src/core/platform/port.ts` (the `PlatformAdapter` interface), `src/adapters/registry.ts`
- `src/adapters/claude/adapter.ts` — implement the port instead of exporting one constant
- `src/application/*.ts` — depend on the port, not on `../adapters/claude/*`
- `src/server/routes/project.ts`, `src/server/context-query.ts`, `src/cli/index.ts`, `src/ui/state/editor-store.ts` — take the platform from the selection
- `src/core/model/index.ts`, `src/core/model/context-presets.ts` — `ContextPreset` becomes adapter-supplied data

Stage B — facts spike per platform (one per platform, timeboxed, S0-style):
- New: `docs/P1-CURSOR-FACTS.md`, `docs/P1-CODEX-FACTS.md`

Stage C — adapters:
- New: `src/adapters/cursor/**`, `src/adapters/codex/**`
- New: `tests/fixtures/cursor/**`, `tests/fixtures/codex/**`
- `tests/fixtures/coverage-report.ts` — per-adapter denominator

## Scope OUT

- Comparing two platforms side by side in one view; cross-platform config translation
- Editing (M3 write path) for any platform other than Claude
- Anything about how the *developer* of Capsight uses Cursor or Claude Code (`.cursor/rules/`, `.claude/agents/` in this repo) — that is tooling, not an inspection target
- Changing any Claude verdict. Stage A must leave every golden byte-identical

## Finding

**One adapter exists, and there is no seam to add a second.** `src/adapters/claude/adapter.ts` is a stub whose entire body is `export const ADAPTER_ID = "claude" as const;`. There is no `PlatformAdapter` interface, no registry, and no runtime selection.

**The core is genuinely clean; the application layer is not.** H1-12 held: `src/core/` carries no `.claude/` path, no frontmatter field name and no version check, and the resolver receives every tool name as data through `PlatformToolTables`. `SourceInfo.platform` and `PlatformVersion.platform` already exist as strings. But `application/`, `server/`, `cli/` and `ui/` import `adapters/claude/*` directly in roughly 25 places — `src/application/resolve.ts:1`, `src/application/scan.ts:3`, `src/cli/index.ts:13`, `src/server/routes/graph.ts:5`, `src/ui/state/editor-store.ts:2` among them. A second adapter has nowhere to plug in without an `if` at each of those call sites.

**One real leak remains in core.** `ContextPreset` (`src/core/model/index.ts`) is a closed union — `main-session | foreground-subagent | background-subagent | fork | explore | plan | teammate` — and `context-presets.ts` fixes the default at `background-subagent` with a T6 justification. That is Claude Code's execution model sitting in the platform-independent layer. Another platform either inherits presets that do not describe it, or the type has to become adapter-supplied. It has to become adapter-supplied.

**The load-bearing problem is not the code — it is §3.** The resolver may rely only on Verified Platform Facts, and every fact in the corpus is a Claude fact, carrying a trust level and a version-matrix entry. There is no Cursor or Codex equivalent. An adapter written without one resolves `unknown` for everything, which is honest and useless; an adapter written by assuming those platforms behave like Claude Code produces confident wrong answers, which inv 14 ranks as worse than shipping nothing. So Stage B is not paperwork — it is the gate on Stage C, exactly as S0 gated M1.

## Acceptance

Stage A — port and switcher:
- [ ] `PlatformAdapter` port defined in core covering the capabilities `application/` actually calls: version detection, discovery/snapshot, resolution, MCP probe, and generation (generation optional per adapter)
- [ ] `application/`, `server/`, `cli/` and `ui/` contain zero direct imports from `src/adapters/claude/**`; all go through the registry
- [ ] `ContextPreset` is adapter-supplied: the preset list, the default and its caption come from the selected adapter, and the H1-24 guarantee (one default and one caption across CLI, API and UI) still holds per platform
- [ ] Platform is selectable on all three surfaces: `--platform` on the CLI, a field on the scan request, a control in the UI beside the project picker (M4-01)
- [ ] An unknown or unsupported platform id is rejected with a named error, never defaulted silently
- [ ] Every existing golden is unchanged and the full suite passes — Stage A is a refactor with no verdict change

Stage B — facts, one document per platform:
- [ ] Each fact recorded with its trust level (`doc` / `ext` / `spike`) and its source, in the §3 format
- [ ] Config file locations, discovery scopes and precedence are **established, not assumed** — no path taken from a model's memory or from analogy with Claude Code
- [ ] Where a platform has no equivalent of a Claude concept (subagents, execution contexts, permission modes, trust), that is recorded as an explicit absence rather than mapped onto the nearest Claude concept
- [ ] A version-detection method exists for the platform, or degraded mode (§8.3) is stated as the permanent condition for it

Stage C — adapters:
- [ ] Each adapter ships with at least a `basic/` fixture and a golden, under its own fixture root
- [ ] Every claim traces to a Stage B fact with a matrix entry; anything else resolves `unknown` and displays as `unknown`
- [ ] The coverage metric reports per adapter — a mature Claude adapter must not flatter an immature one (§11.4, inv 13)
- [ ] The UI never presents a Cursor or Codex answer with Claude's confidence styling when the underlying fact trust differs
- [ ] `npm run test` and `npm run typecheck` pass

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's config directories
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

**This document is phase-sized, not implementer-sized.** DEVELOPMENT.md gives an implementer one atomic task; the three stages here are at least five. Split before delegating — suggested: P1-01 port + registry, P1-02 `ContextPreset` de-Claude-ing, P1-03 switcher across the three surfaces, P1-04 Cursor spike + adapter, P1-05 Codex spike + adapter. Stage A is worth doing on its own merits: it completes inv 1 at the application layer whether or not a second platform ever lands.

**Sequencing:** M4-01 first. The platform switch and the project picker are one selection in the UI, and building the picker twice is waste.

**Product-boundary decision needed before Stage C, from the owner, not the implementer.** README and SPEC §1/§2.1 define Capsight as an inspector of *Claude Code* configuration. Multi-platform is absent from the Non-goals list (§2.3) and equally absent from the roadmap. Adding two platforms changes what the product is, and §0.1 rule 6 forbids scope expansion on the implementer's judgement. Record the decision in ROADMAP before Stage B starts.

**The honest risk, stated once.** Capsight's value is that it answers precisely and refuses to guess. A second adapter without a fact corpus does not extend that value to a new platform — it dilutes it, because the UI shape implies the same rigour behind every answer. Either each platform earns its facts, or it should not appear in the switcher.
