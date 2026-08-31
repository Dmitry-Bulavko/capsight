---
name: vendor-auditor
description: Agent from the added directory, attached through --add-dir (A9)
tools:
  - Read
skills:
  - vendor-lint
mcpServers:
  - command: node
    args: ["vendor-inline-mcp.js"]
---

You audit the vendored library.
