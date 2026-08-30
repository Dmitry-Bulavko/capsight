---
name: hooked
description: Project agent whose frontmatter hooks wait on folder trust (R5)
tools:
  - Read
hooks:
  PreToolUse:
    - command: never-runs
---

You declare frontmatter hooks in a project-scoped agent (R5).
