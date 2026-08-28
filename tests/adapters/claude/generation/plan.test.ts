import { describe, expect, it } from "vitest";
import type { Agent } from "../../../../src/core/model/index.js";
import {
  computeAgentToolFrontmatter,
  diffToolFrontmatter,
} from "../../../../src/adapters/claude/generation/plan.js";

const ALLOWLIST_AGENT: Agent = {
  id: "allowlist",
  name: "backend",
  description: "Backend agent",
  source: {
    platform: "claude",
    scope: "project",
    path: "/project/.claude/agents/backend.md",
  },
  status: "active",
  configuration: {
    tools: ["Read", "Grep"],
    disallowedTools: ["Bash"],
    unknownFields: {},
  },
  isPluginAgent: false,
};

const DENYLIST_AGENT: Agent = {
  ...ALLOWLIST_AGENT,
  id: "denylist",
  configuration: {
    disallowedTools: ["Bash"],
    unknownFields: {},
  },
};

describe("computeAgentToolFrontmatter", () => {
  it("adds tools in allowlist mode when enabling", () => {
    const next = computeAgentToolFrontmatter(ALLOWLIST_AGENT, { Write: true });
    expect(next.tools).toEqual(["Grep", "Read", "Write"]);
    expect(next.disallowedTools).toEqual(["Bash"]);
  });

  it("removes tools in allowlist mode when disabling", () => {
    const next = computeAgentToolFrontmatter(ALLOWLIST_AGENT, { Read: false });
    expect(next.tools).toEqual(["Grep"]);
    expect(next.disallowedTools).toEqual(["Bash"]);
  });

  it("removes from disallowedTools in denylist mode when enabling", () => {
    const next = computeAgentToolFrontmatter(DENYLIST_AGENT, { Bash: true });
    expect(next.tools).toBeUndefined();
    expect(next.disallowedTools).toBeUndefined();
  });

  it("adds to disallowedTools in denylist mode when disabling", () => {
    const next = computeAgentToolFrontmatter(DENYLIST_AGENT, { Read: false });
    expect(next.tools).toBeUndefined();
    expect(next.disallowedTools).toEqual(["Bash", "Read"]);
  });

  it("removes overlap from disallowedTools when enabling allowlist tool", () => {
    const agent: Agent = {
      ...ALLOWLIST_AGENT,
      configuration: {
        tools: ["Read"],
        disallowedTools: ["Read"],
        unknownFields: {},
      },
    };

    const next = computeAgentToolFrontmatter(agent, { Read: true });
    expect(next.tools).toEqual(["Read"]);
    expect(next.disallowedTools).toBeUndefined();
  });
});

describe("diffToolFrontmatter", () => {
  it("returns only changed fields", () => {
    const changes = diffToolFrontmatter(ALLOWLIST_AGENT.configuration, {
      tools: ["Grep", "Read", "Write"],
      disallowedTools: ["Bash"],
    });

    expect(changes).toEqual([
      {
        field: "tools",
        before: ["Grep", "Read"],
        after: ["Grep", "Read", "Write"],
      },
    ]);
  });

  it("returns empty when frontmatter is unchanged", () => {
    expect(
      diffToolFrontmatter(ALLOWLIST_AGENT.configuration, {
        tools: ["Read", "Grep"],
        disallowedTools: ["Bash"],
      }),
    ).toEqual([]);
  });
});
