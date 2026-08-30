# D1-14: Command file in `skills:` list must not report `preloaded`

## Goal

When an agent's frontmatter `skills:` entry resolves to a `.claude/commands/*.md` file, resolution must not claim `preloaded` on K1's authority — K1 covers skill content preload, not slash commands.

## Spec refs

- SPEC §3.6 K1 (frontmatter skills preload)
- SPEC §8.2, M1 acceptance #9
- Pre-existing on `origin/main`; reproduced in D1-05 review notes

## Scope IN

- `src/adapters/claude/discovery/types.ts` — distinguish skill vs command on `DiscoveredSkill`
- `src/adapters/claude/discovery/skills.ts` — tag command discoveries with `kind: "command"`
- `src/adapters/claude/resolution/skills.ts` — command-backed name resolves `unknown`, not `preloaded`
- `tests/fixtures/claude/skills-preload/` — extend or add case where `skills:` lists a command name
- `src/adapters/claude/version/matrix.ts` — note on `skills.preload` if needed (K1 scope)

## Scope OUT

- Cursor/Codex adapters
- Executing commands
- Changing K11 discovery precedence

## Design decisions

**Root cause:** `discoverCommands` returns the same shape as skills; `buildSkillPreloadCapabilities` matches by name and always emits `preloaded` + K1 reason.

**Fix:** Add optional `kind: "skill" | "command"` on `DiscoveredSkill` (default `"skill"` for existing paths). Commands from `.claude/commands/` get `kind: "command"`. Preload resolver: if matched discovery has `kind: "command"`, emit `status: "unknown"` with a reason that K1 does not cover command files — do not cite K1 as authority.

**Golden:** Extend `skills-preload` fixture: agent lists a command name in `skills:`; golden expects `unknown` for that capability. Re-record only the delta; helper and restricted skill cases unchanged.

**Deletion test:** With command-kind check removed, command name would flip to `preloaded` — verify in unit test or matrix note.

## Acceptance

- [ ] `DiscoveredSkill` carries `kind: "skill" | "command"`; commands tagged at discovery
- [ ] Command name in frontmatter `skills:` resolves `unknown`, not `preloaded`
- [ ] Reason does not attribute command preload to K1
- [ ] `skills-preload` golden updated and passes
- [ ] Existing helper/restricted preload cases unchanged

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

This is a honesty fix, not a new platform claim. Understating is always permissible.
