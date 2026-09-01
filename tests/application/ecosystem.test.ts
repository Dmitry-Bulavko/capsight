import { describe, expect, it } from "vitest";
import { buildEcosystemInventory } from "../../src/application/ecosystem.js";
import { RESOURCE_CLASS } from "../../src/core/compat/resource-class.js";
import { makeAgent, makePlatformScanResult } from "../helpers/ecosystem-fixtures.js";

describe("buildEcosystemInventory()", () => {
  it("merges resources from multiple platform snapshots", () => {
    const inventory = buildEcosystemInventory({
      projectPath: "/repo",
      detection: [
        { platform: "cursor", status: "detected", evidence: [] },
        { platform: "codex", status: "detected", evidence: [] },
        { platform: "claude", status: "not-detected", evidence: [] },
      ],
      scans: {
        cursor: makePlatformScanResult("cursor", {
          instructions: [
            {
              id: "agents-md",
              type: "AGENTS.md",
              path: "/repo/AGENTS.md",
              scope: "project",
              sizeBytes: 12,
            },
          ],
        }),
        codex: makePlatformScanResult("codex", {
          agents: [
            makeAgent({
              id: "primary",
              name: "primary",
              source: {
                platform: "codex",
                scope: "project",
                path: "/repo/AGENTS.md",
              },
            }),
          ],
        }),
      },
    });

    expect(inventory.resources.instruction).toHaveLength(1);
    expect(inventory.resources.agent).toHaveLength(1);
    expect(inventory.resources.instruction[0]).toMatchObject({
      platform: "cursor",
      kind: "instruction",
      scope: "project",
      resourceClass: RESOURCE_CLASS.INSTRUCTION_AGENTS_MD,
      path: "/repo/AGENTS.md",
      id: "cursor:instruction:agents-md",
    });
    expect(inventory.resources.agent[0]).toMatchObject({
      platform: "codex",
      kind: "agent",
      scope: "project",
      resourceClass: RESOURCE_CLASS.AGENT_MARKDOWN,
      path: "/repo/AGENTS.md",
      id: "codex:agent:primary",
    });
  });

  it("ignores scans for platforms that were not detected", () => {
    const inventory = buildEcosystemInventory({
      projectPath: "/repo",
      detection: [
        { platform: "cursor", status: "detected", evidence: [] },
        { platform: "codex", status: "detected", evidence: [] },
        { platform: "claude", status: "not-detected", evidence: [] },
      ],
      scans: {
        cursor: makePlatformScanResult("cursor", {
          instructions: [
            {
              id: "agents-md",
              type: "AGENTS.md",
              path: "/repo/AGENTS.md",
              scope: "project",
              sizeBytes: 12,
            },
          ],
        }),
        claude: makePlatformScanResult("claude", {
          agents: [
            makeAgent({
              id: "fallback",
              name: "fallback",
              source: {
                platform: "claude",
                scope: "project",
                path: "/repo/.claude/agents/fallback.md",
              },
            }),
          ],
        }),
      },
    });

    expect(inventory.resources.instruction).toHaveLength(1);
    expect(inventory.resources.agent).toHaveLength(0);
  });

  it("preserves local and user scopes verbatim from SourceInfo", () => {
    const inventory = buildEcosystemInventory({
      projectPath: "/repo",
      detection: [{ platform: "claude", status: "detected", evidence: [] }],
      scans: {
        claude: makePlatformScanResult("claude", {
          agents: [
            makeAgent({
              id: "local-backend",
              name: "backend",
              source: {
                platform: "claude",
                scope: "local",
                path: "/repo/.claude/agents/backend.local.md",
              },
            }),
            makeAgent({
              id: "user-backend",
              name: "backend",
              source: {
                platform: "claude",
                scope: "user",
                path: "/home/user/.claude/agents/backend.md",
              },
            }),
          ],
        }),
      },
    });

    expect(inventory.resources.agent.map((resource) => resource.scope).sort()).toEqual([
      "local",
      "user",
    ]);
  });

  it("links same-identity resources across scopes with adapter collision verdict", () => {
    const projectAgent = makeAgent({
      id: "backend-project",
      source: {
        platform: "claude",
        scope: "project",
        path: "/repo/.claude/agents/backend.md",
      },
      status: "active",
    });
    const localAgent = makeAgent({
      id: "backend-local",
      source: {
        platform: "claude",
        scope: "local",
        path: "/repo/.claude/agents/backend.local.md",
      },
      status: "shadowed",
      collision: {
        candidates: [
          projectAgent.source,
          {
            platform: "claude",
            scope: "local",
            path: "/repo/.claude/agents/backend.local.md",
          },
        ],
        effective: projectAgent.source,
        rule: "A1",
        matrixRef: "compat.claude.agent-markdown",
        enforcement: "enforced",
      },
    });

    const inventory = buildEcosystemInventory({
      projectPath: "/repo",
      detection: [{ platform: "claude", status: "detected", evidence: [] }],
      scans: {
        claude: makePlatformScanResult("claude", {
          agents: [projectAgent, localAgent],
        }),
      },
    });

    expect(inventory.overlaps).toHaveLength(1);
    expect(inventory.overlaps[0]).toMatchObject({
      ids: ["claude:agent:backend-local", "claude:agent:backend-project"],
      collision: {
        rule: "A1",
        matrixRef: "compat.claude.agent-markdown",
        effective: projectAgent.source,
      },
    });
  });

  it("records overlaps without an effective winner when the adapter omits one", () => {
    const collision = {
      candidates: [
        {
          platform: "claude",
          scope: "project" as const,
          path: "/repo/.claude/agents/dup-a.md",
        },
        {
          platform: "claude",
          scope: "project" as const,
          path: "/repo/.claude/agents/dup-b.md",
        },
      ],
      rule: "A4",
      matrixRef: "compat.claude.agent-markdown",
      enforcement: "unknown" as const,
    };
    const first = makeAgent({
      id: "dup-a",
      source: collision.candidates[0]!,
      status: "ambiguous",
      collision,
    });
    const second = makeAgent({
      id: "dup-b",
      name: "dup",
      source: collision.candidates[1]!,
      status: "ambiguous",
      collision,
    });

    const inventory = buildEcosystemInventory({
      projectPath: "/repo",
      detection: [{ platform: "claude", status: "detected", evidence: [] }],
      scans: {
        claude: makePlatformScanResult("claude", {
          agents: [first, second],
        }),
      },
    });

    expect(inventory.overlaps).toHaveLength(1);
    expect(inventory.overlaps[0]?.collision.effective).toBeUndefined();
    expect(inventory.overlaps[0]?.collision.rule).toBe("A4");
  });

  it("groups resources by kind with required metadata fields", () => {
    const inventory = buildEcosystemInventory({
      projectPath: "/repo",
      detection: [{ platform: "cursor", status: "detected", evidence: [] }],
      scans: {
        cursor: makePlatformScanResult("cursor", {
          skills: [
            {
              id: "lint",
              name: "lint",
              source: { platform: "cursor", scope: "project", path: "/repo/.cursor/skills/lint" },
              path: "/repo/.cursor/skills/lint/SKILL.md",
              kind: "skill",
            },
          ],
          mcpServers: [
            {
              id: "github",
              name: "github",
              source: { platform: "cursor", scope: "project", path: "/repo/.cursor/mcp.json" },
              configPath: "/repo/.cursor/mcp.json",
              definitionKind: "config-file",
            },
          ],
        }),
      },
    });

    expect(inventory.resources.skill[0]).toMatchObject({
      kind: "skill",
      platform: "cursor",
      scope: "project",
      resourceClass: RESOURCE_CLASS.SKILL_DIRECTORY,
      path: "/repo/.cursor/skills/lint/SKILL.md",
      id: "cursor:skill:lint",
    });
    expect(inventory.resources.mcp_server[0]).toMatchObject({
      kind: "mcp_server",
      platform: "cursor",
      scope: "project",
      resourceClass: RESOURCE_CLASS.MCP_JSON_CONFIG,
      path: "/repo/.cursor/mcp.json",
      id: "cursor:mcp_server:github",
    });
  });
});
