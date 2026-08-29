# EC-06: Resource detail panel with rendered markdown

## Goal

Clicking a node opens a panel with the resource's metadata, its related files and folders, its collisions, and its markdown body rendered rather than raw.

## Spec refs

- SPEC §7.5 (Why-panel precedent), §12.4
- SPEC §13 invariant 10 (no secrets in any surface)

## Scope IN

- `src/ui/components/ResourceDetailPanel.tsx`
- `src/ui/components/MarkdownBody.tsx`
- `src/ui/api.ts`
- `src/ui/styles.css`
- `package.json` — markdown renderer + sanitizer dependency
- `tests/ui/resource-detail-panel.test.ts`, `tests/ui/markdown-body.test.ts`

## Scope OUT

- Editing any content
- The content endpoint (EC-03)

## Design decisions

**New dependency, named deliberately.** The UI has no markdown renderer today. Take `marked` + `dompurify` (small, no React coupling) or `react-markdown` + `rehype-sanitize`. Sanitizing is not optional: the panel renders files from a repository the viewer may not have written. Raw HTML in a `SKILL.md` must never execute.

**Panel sections, in this order:** identity (name, kind, platform, scope, resource class) → compat verdicts with their facts → source paths and related folders → collisions and what wins → rendered body.

**No content section for MCP and settings.** Per EC-03 those resources have no content route; the panel shows the redacted structural model — transport, command name, env **key names** — and states plainly that values are never read into the tool.

**Reuse the Why-panel's visual language.** This panel is its sibling; it should not introduce a second styling idiom.

**Degrade honestly.** Unreadable file, truncated file, absent body — each says which, rather than rendering blank.

## Acceptance

- [ ] Selecting any node opens the panel; the canvas keeps the node visibly selected
- [ ] Metadata, source paths, related folders and collision verdicts render for every resource kind
- [ ] Markdown renders with headings, lists, tables and code blocks styled to the app's typography
- [ ] Raw HTML and `javascript:` URLs in a source file are sanitized; test asserts a `<script>` in a fixture skill does not reach the DOM
- [ ] MCP and settings resources show the redacted model and no content section
- [ ] Truncated and unreadable bodies state their condition explicitly
- [ ] Frontmatter renders as fields, not as text at the top of the body

## Done checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] No writes to scanned project's `.claude/**`
- [ ] TASKS.md updated by orchestrator (not implementer)

## Notes

The sanitizer test is the load-bearing one here: rendering third-party markdown is the feature, and it is also the attack surface.
