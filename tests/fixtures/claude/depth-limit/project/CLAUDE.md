# Depth limit fixture project

`env.json` sets `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` (N3). Contexts that name
`maxDepth` explicitly override it; contexts that omit it inherit the env value.
