import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  computeDescriptionBudget,
  DESCRIPTION_BUDGET_THRESHOLD,
  estimateDescriptionTokens,
  isUserAgentForBudget,
} from "../../../../src/adapters/claude/discovery/description-budget.js";
import { buildProjectSnapshot } from "../../../../src/adapters/claude/discovery/snapshot.js";
import type {
  PlatformVersion,
  SourceInfo,
} from "../../../../src/core/model/index.js";
import type { ClaudeAgent as Agent } from "../../../../src/adapters/claude/model/index.js";
import type { WalkProjectScopesResult } from "../../../../src/adapters/claude/discovery/project-walk.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

const SOURCE: SourceInfo = {
  platform: "claude",
  scope: "project",
  path: ".claude/agents/test.md",
};

const VERSION: PlatformVersion = {
  platform: "claude",
  version: "2.1.0",
  raw: "2.1.0",
  detectedAt: "2026-01-01T00:00:00.000Z",
};

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    name: "test-agent",
    description: "short description",
    source: SOURCE,
    status: "active",
    configuration: { unknownFields: {} },
    isPluginAgent: false,
    ...overrides,
  };
}

describe("estimateDescriptionTokens", () => {
  it("uses chars/4 ceiling", () => {
    expect(estimateDescriptionTokens("")).toBe(0);
    expect(estimateDescriptionTokens("abcd")).toBe(1);
    expect(estimateDescriptionTokens("abcde")).toBe(2);
  });
});

describe("isUserAgentForBudget", () => {
  it("excludes plugin and invalid agents", () => {
    expect(isUserAgentForBudget(makeAgent())).toBe(true);
    expect(isUserAgentForBudget(makeAgent({ isPluginAgent: true }))).toBe(false);
    expect(isUserAgentForBudget(makeAgent({ status: "invalid" }))).toBe(false);
  });

  it("includes shadowed and ambiguous agents", () => {
    expect(isUserAgentForBudget(makeAgent({ status: "shadowed" }))).toBe(true);
    expect(isUserAgentForBudget(makeAgent({ status: "ambiguous" }))).toBe(true);
  });
});

describe("computeDescriptionBudget", () => {
  it("emits no warning when total is at or below threshold", () => {
    const description = "x".repeat(DESCRIPTION_BUDGET_THRESHOLD * 4);
    const result = computeDescriptionBudget([makeAgent({ description })]);

    expect(result.totalEstimatedTokens).toBe(DESCRIPTION_BUDGET_THRESHOLD);
    expect(result.warnings).toEqual([]);
  });

  it("emits budget warning with per-agent breakdown when over threshold", () => {
    const heavy = "x".repeat(DESCRIPTION_BUDGET_THRESHOLD * 4 + 4);
    const light = "y".repeat(100);

    const result = computeDescriptionBudget([
      makeAgent({
        id: "heavy",
        name: "heavy-agent",
        description: heavy,
        source: { ...SOURCE, path: ".claude/agents/heavy.md" },
      }),
      makeAgent({
        id: "light",
        name: "light-agent",
        description: light,
        source: { ...SOURCE, path: ".claude/agents/light.md" },
      }),
    ], "2.1.240");

    expect(result.totalEstimatedTokens).toBeGreaterThan(DESCRIPTION_BUDGET_THRESHOLD);
    expect(result.warnings).toHaveLength(1);

    const warning = result.warnings[0]!;
    expect(warning.category).toBe("budget");
    expect(warning.severity).toBe("warning");
    expect(warning.matrixRef).toBe("agent.descriptionBudget");
    // A10 is a startup warning, not a boundary the platform applies (§6).
    expect(warning.enforcement).toBe("advisory");
    expect(warning.message).toContain(String(DESCRIPTION_BUDGET_THRESHOLD));
    expect(warning.message).toContain("heavy-agent");
    expect(warning.message).toContain("light-agent");
    expect(warning.evidence).toHaveLength(2);
    expect(warning.evidence.every((entry) => entry.fieldPath === "frontmatter.description")).toBe(
      true,
    );
  });

  it("reports the budget warning as undetermined in degraded mode (§8.3)", () => {
    const heavy = "x".repeat(DESCRIPTION_BUDGET_THRESHOLD * 4 + 4);
    const result = computeDescriptionBudget([
      makeAgent({ name: "heavy-agent", description: heavy }),
    ]);

    const warning = result.warnings[0]!;
    expect(warning.enforcement).toBe("unknown");
    expect(warning.matrixRef).toBe("agent.descriptionBudget");
    expect(warning.message).toContain("SPEC §8.3");
    // The finding itself is still reported — only the platform claim is not.
    expect(warning.message).toContain("heavy-agent");
  });

  it("skips plugin agents in the total", () => {
    const heavy = "x".repeat(DESCRIPTION_BUDGET_THRESHOLD * 4 + 4);
    const result = computeDescriptionBudget([
      makeAgent({ description: heavy, isPluginAgent: true }),
    ]);

    expect(result.totalEstimatedTokens).toBe(0);
    expect(result.warnings).toEqual([]);
  });
});

describe("buildProjectSnapshot budget wiring", () => {
  async function makeTempProject(structure: Record<string, string>): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "capsight-budget-"));
    tempDirs.push(dir);
    for (const [rel, content] of Object.entries(structure)) {
      const filePath = path.join(dir, rel);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content);
    }
    return dir;
  }

  it("attaches budget warnings to snapshot", async () => {
    const longDescription = "Review code carefully. ".repeat(3500);
    const project = await makeTempProject({
      ".claude/agents/reviewer.md": `---
name: reviewer
description: ${longDescription}
---
Prompt
`,
      "CLAUDE.md": "# Project",
    });

    const walk: WalkProjectScopesResult = {
      projectPath: project,
      repoRoot: project,
      scopes: [
        {
          path: project,
          hasClaudeDir: true,
          agentsPath: path.join(project, ".claude", "agents"),
        },
      ],
    };

    const snapshot = await buildProjectSnapshot({
      projectPath: project,
      version: VERSION,
      walk,
    });

    expect(snapshot.warnings.some((warning) => warning.category === "budget")).toBe(true);
  });
});
