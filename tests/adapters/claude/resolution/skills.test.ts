import { describe, expect, it } from "vitest";
import type { ExecutionContext } from "../../../../src/core/model/index.js";
import type {
  ClaudeAgent as Agent,
  ClaudeProjectSnapshot as ProjectSnapshot,
} from "../../../../src/adapters/claude/model/index.js";
import type { DiscoveredSkill } from "../../../../src/adapters/claude/discovery/types.js";
import { buildSkillPreloadCapabilities } from "../../../../src/adapters/claude/resolution/skills.js";
import { FACT } from "../../../../src/adapters/claude/version/facts.js";

const CONTEXT: ExecutionContext = {
  preset: "foreground-subagent",
  isMainSession: false,
  isBackground: false,
  isFork: false,
  isTeammate: false,
  depth: 0,
  maxDepth: 3,
};

function agent(skillNames: string[]): Agent {
  return {
    id: "agent-preloader",
    name: "preloader",
    description: "test agent",
    source: { platform: "claude", scope: "project", path: "/project/.claude/agents/preloader.md" },
    status: "active",
    configuration: { skills: skillNames, unknownFields: {} },
    isPluginAgent: false,
  };
}

function snapshot(skills: DiscoveredSkill[]): ProjectSnapshot {
  return {
    id: "snapshot-1",
    projectPath: "/project",
    scannedAt: "2026-01-01T00:00:00.000Z",
    warnings: [],
    version: {
      platform: "claude",
      version: "2.1.240",
      raw: "2.1.240",
      detectedAt: "2026-01-01T00:00:00.000Z",
    },
    skills,
    agents: [],
    instructions: [],
    mcpServers: [],
    settings: [],
    trust: { accepted: true, projectPath: "/project" },
    environment: { relevant: [] },
  };
}

describe("buildSkillPreloadCapabilities", () => {
  it("preloads discovered skills under K1", async () => {
    const capabilities = await buildSkillPreloadCapabilities(
      agent(["helper"]),
      snapshot([
        {
          id: "1",
          name: "helper",
          path: "/project/.claude/skills/helper/SKILL.md",
          source: { platform: "claude", scope: "project", path: "/project/.claude/skills/helper/SKILL.md" },
        },
      ]),
      CONTEXT,
    );

    expect(capabilities).toHaveLength(1);
    expect(capabilities[0]).toMatchObject({
      capabilityId: "skill:helper",
      status: "preloaded",
      reasons: [{ type: "declared", matrixRef: FACT.K1 }],
    });
  });

  it("resolves command files listed in skills as unknown, not preloaded (D1-14)", async () => {
    const capabilities = await buildSkillPreloadCapabilities(
      agent(["deploy"]),
      snapshot([
        {
          id: "2",
          name: "deploy",
          kind: "command",
          path: "/project/.claude/commands/deploy.md",
          source: {
            platform: "claude",
            scope: "project",
            path: "/project/.claude/commands/deploy.md",
          },
        },
      ]),
      CONTEXT,
    );

    expect(capabilities).toHaveLength(1);
    expect(capabilities[0]).toMatchObject({
      capabilityId: "skill:deploy",
      status: "unknown",
      enforcement: "advisory",
    });
    expect(capabilities[0]?.reasons[0]?.type).toBe("unknown");
    expect(capabilities[0]?.reasons[0]?.message).toContain("K1 covers skill content preload only");
    expect(capabilities[0]?.reasons.some((reason) => reason.matrixRef === FACT.K1)).toBe(false);
  });
});
