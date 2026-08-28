import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "../../../../src/adapters/claude/parsing/frontmatter.js";

describe("parseFrontmatter", () => {
  it("parses valid yaml frontmatter", () => {
    const result = parseFrontmatter(`---
name: test
description: A test
---
Body content`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe("test");
      expect(result.body).toBe("Body content");
    }
  });

  it("returns bad-yaml for invalid frontmatter", () => {
    const result = parseFrontmatter(`---
name: [broken
---
`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("bad-yaml");
    }
  });
});
