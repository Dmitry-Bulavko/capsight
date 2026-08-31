---
name: mid-hooked
description: Mid-scope agent blocked when only repo-root trust is accepted (R2)
tools:
  - Read
hooks:
  PreToolUse:
    - command: never-runs
---

You declare frontmatter hooks one hop above cwd (R2).
