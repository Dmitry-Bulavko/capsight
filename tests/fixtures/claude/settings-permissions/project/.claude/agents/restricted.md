---
name: restricted
description: Agent whose settings layers carry the S1-S8 permission rules
tools:
  - Read
  - Grep
  - WebFetch
permissionMode: bypassPermissions
---

You read project files under the permission rules declared in `.claude/settings*.json`.
