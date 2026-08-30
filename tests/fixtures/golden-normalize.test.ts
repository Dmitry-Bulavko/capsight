import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ClaudeProjectSnapshot as ProjectSnapshot } from "../../src/adapters/claude/model/index.js";
import type {
  EffectiveConfiguration,
  PlatformVersion,
  ResolvedCapability,
} from "../../src/core/model/index.js";
import { normalizeGoldenOutput } from "./golden-normalize.js";

const PROJECT_ROOT = path.resolve("/workspace/project");
const AGENT_RELATIVE_PATH = ".claude/agents/hooked.md";
const AGENT_ABSOLUTE_PATH = path.join(PROJECT_ROOT, AGENT_RELATIVE_PATH);
const VERSION: PlatformVersion = {
  platform: "claude",
  version: "2.1.0",
  raw: "2.1.0",
  detectedAt: "2026-01-01T00:00:00.000Z",
};

function emptySnapshot(): ProjectSnapshot {
  return {
    id: "snapshot-1",
    projectPath: PROJECT_ROOT,
    version: VERSION,
    agents: [],
    skills: [],
    instructions: [],
    mcpServers: [],
    settings: [],
    trust: { accepted: false, projectPath: PROJECT_ROOT },
    environment: { relevant: [] },
    warnings: [],
    scannedAt: "2026-01-01T00:00:00.000Z",
  };
}

function emptyResolution(
  capabilities: ResolvedCapability[],
): EffectiveConfiguration {
  return {
    agentId: "agent-1",
    version: VERSION,
    context: {
      preset: "foreground-subagent",
      isMainSession: false,
      isBackground: false,
      isFork: false,
      isTeammate: false,
      depth: 0,
      maxDepth: 3,
    },
    capabilities,
    warnings: [],
    unknownRate: 0,
  };
}

describe("golden-normalize capability ids", () => {
  it("keeps agent-hooks and instruction capabilities distinct when they share a source path", () => {
    const hooksCapability: ResolvedCapability = {
      capabilityId: "agent-hooks",
      kind: "instruction",
      status: "blocked",
      enforcement: "enforced",
      sources: [
        {
          platform: "claude",
          scope: "project",
          path: AGENT_ABSOLUTE_PATH,
          fieldPath: "frontmatter.hooks",
        },
      ],
      reasons: [],
    };

    const instructionCapability: ResolvedCapability = {
      capabilityId: "deadbeef",
      kind: "instruction",
      status: "available",
      enforcement: "advisory",
      sources: [
        {
          platform: "claude",
          scope: "project",
          path: AGENT_ABSOLUTE_PATH,
        },
      ],
      reasons: [],
    };

    const normalized = normalizeGoldenOutput(
      emptySnapshot(),
      [
        {
          agentName: "hooked",
          resolution: emptyResolution([hooksCapability, instructionCapability]),
        },
      ],
      PROJECT_ROOT,
    );

    const ids = normalized.resolutions[0]!.capabilities.map(
      (capability) => capability.capabilityId,
    );

    expect(ids).toEqual([
      `hooks:${AGENT_RELATIVE_PATH}`,
      `instruction:${AGENT_RELATIVE_PATH}`,
    ]);
    expect(new Set(ids).size).toBe(2);
  });
});
