import { describe, expect, it } from "vitest";
import { applyFrontmatterFieldChanges } from "../../../../src/adapters/claude/generation/apply.js";

const ORIGINAL = `---
name: backend
description: Backend agent
tools:
  - Read
  - Grep
disallowedTools:
  - Bash
---

You are a backend developer.
`;

describe("applyFrontmatterFieldChanges", () => {
  it("updates only planned tool fields", () => {
    const updated = applyFrontmatterFieldChanges(ORIGINAL, [
      {
        field: "tools",
        after: ["Grep", "Read", "Write"],
      },
    ]);

    expect(updated).toContain("Write");
    expect(updated).toContain("name: backend");
    expect(updated).toContain("You are a backend developer.");
    expect(updated).toContain("disallowedTools:");
    expect(updated).toContain("Bash");
  });

  it("removes a field when after is empty", () => {
    const updated = applyFrontmatterFieldChanges(ORIGINAL, [
      {
        field: "disallowedTools",
        after: [],
      },
    ]);

    expect(updated).not.toContain("disallowedTools:");
    expect(updated).toContain("tools:");
  });
});
