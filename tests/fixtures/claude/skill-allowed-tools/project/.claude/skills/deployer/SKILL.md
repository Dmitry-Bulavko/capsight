---
name: deployer
description: Skill that pre-approves deployment tools via allowed-tools
allowed-tools:
  - Bash(git push:*)
  - Write
  - Read
---

Deploy the project. `allowed-tools` above pre-approves these tools; it does not
restrict the agent to them (K6).
