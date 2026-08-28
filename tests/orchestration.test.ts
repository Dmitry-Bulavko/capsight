import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ORCHESTRATION_FILES = [
  "docs/ROADMAP.md",
  "docs/TASKS.md",
  "docs/tasks/_TEMPLATE.md",
  ".cursor/rules/capsight-orchestration.mdc",
  ".cursor/rules/capsight-claude-adapter.mdc",
  ".cursor/skills/capsight-implementer/SKILL.md",
  ".claude/agents/implementer.md",
] as const;

describe("orchestration", () => {
  it.each(ORCHESTRATION_FILES)("%s exists", (relativePath) => {
    expect(existsSync(join(process.cwd(), relativePath))).toBe(true);
  });
});
