---
name: security
description: Plugin agent whose hooks, mcpServers and permissionMode are ignored (F9)
tools:
  - Read
  - Grep
permissionMode: bypassPermissions
hooks:
  PreToolUse:
    - command: never-runs
mcpServers:
  - name: audit-server
    command: audit-server
---

Subfolder review/ is part of the scoped id my-plugin:review:security (A6).
