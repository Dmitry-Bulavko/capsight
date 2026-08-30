import { describe, expect, it } from "vitest";
import { RESOURCE_CLASS } from "../../src/core/compat/resource-class.js";
import type { InventoryResourceKind, OverlapRelation } from "../../src/core/model/ecosystem.js";
import type { InventoryResourceWithCompat } from "../../src/server/routes/ecosystem.js";
import {
  ECOSYSTEM_BLOCK_ORDER,
  isOverlapResolved,
  layoutEcosystemGraph,
} from "../../src/ui/ecosystem-layout.js";

function makeResource(
  overrides: Partial<InventoryResourceWithCompat> & Pick<InventoryResourceWithCompat, "id">,
): InventoryResourceWithCompat {
  const kind = overrides.kind ?? "agent";
  return {
    platform: "claude",
    scope: "project",
    resourceClass: RESOURCE_CLASS.AGENT_MARKDOWN,
    name: overrides.id.split(":").pop(),
    compat: {},
    kind,
    ...overrides,
  };
}

function emptyResources(): Record<InventoryResourceKind, InventoryResourceWithCompat[]> {
  return {
    agent: [],
    skill: [],
    mcp_server: [],
    instruction: [],
  };
}

function makeOverlap(
  ids: [string, string],
  resolved: boolean,
): OverlapRelation {
  return {
    ids,
    collision: {
      candidates: [],
      rule: resolved ? "A1" : "A4",
      ...(resolved
        ? {
            effective: {
              platform: "claude",
              scope: "project" as const,
              path: "/repo/.claude/agents/backend.md",
            },
          }
        : {}),
    },
  };
}

describe("layoutEcosystemGraph", () => {
  it("creates four block nodes even when every block is empty", () => {
    const { nodes, edges, dimmedCount } = layoutEcosystemGraph({
      resources: emptyResources(),
      overlaps: [],
    });

    const blocks = nodes.filter((node) => node.type === "ecosystemBlock");
    expect(blocks).toHaveLength(4);
    expect(ECOSYSTEM_BLOCK_ORDER.every((kind) => blocks.some((node) => node.id === `block:${kind}`))).toBe(
      true,
    );
    expect(blocks.every((node) => node.data.empty === true)).toBe(true);
    expect(edges).toHaveLength(0);
    expect(dimmedCount).toBe(0);
  });

  it("places resources from multiple platforms inside their kind blocks", () => {
    const resources = emptyResources();
    resources.agent = [
      makeResource({ id: "claude:agent:backend", platform: "claude", name: "backend" }),
      makeResource({ id: "codex:agent:primary", platform: "codex", name: "primary" }),
    ];
    resources.skill = [
      makeResource({
        id: "cursor:skill:lint",
        kind: "skill",
        platform: "cursor",
        name: "lint",
        resourceClass: RESOURCE_CLASS.SKILL_DIRECTORY,
      }),
    ];

    const { nodes } = layoutEcosystemGraph({ resources, overlaps: [] });
    const resourceNodes = nodes.filter((node) => node.type === "ecosystemResource");

    expect(resourceNodes).toHaveLength(3);
    expect(resourceNodes.map((node) => node.parentId)).toEqual([
      "block:agent",
      "block:agent",
      "block:skill",
    ]);
  });

  it("lays overlapping local and repository resources adjacently with an overlaps edge", () => {
    const localId = "claude:agent:backend-local";
    const projectId = "claude:agent:backend-project";
    const resources = emptyResources();
    resources.agent = [
      makeResource({ id: localId, scope: "local", name: "backend.local" }),
      makeResource({ id: projectId, scope: "project", name: "backend" }),
    ];
    const overlaps = [makeOverlap([localId, projectId], true)];

    const { nodes, edges } = layoutEcosystemGraph({ resources, overlaps });
    const localNode = nodes.find((node) => node.id === localId);
    const projectNode = nodes.find((node) => node.id === projectId);

    expect(localNode).toBeDefined();
    expect(projectNode).toBeDefined();
    expect(localNode!.position.x).toBeLessThan(projectNode!.position.x);
    expect(projectNode!.position.x - localNode!.position.x).toBeLessThanOrEqual(180);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      source: localId,
      target: projectId,
      label: "overlaps",
      data: { resolved: true },
    });
  });

  it("marks unresolved overlaps with dashed styling metadata", () => {
    const firstId = "claude:agent:dup-a";
    const secondId = "claude:agent:dup-b";
    const resources = emptyResources();
    resources.agent = [
      makeResource({ id: firstId, scope: "local", name: "dup-a" }),
      makeResource({ id: secondId, scope: "project", name: "dup-b" }),
    ];
    const overlaps = [makeOverlap([firstId, secondId], false)];

    const { edges } = layoutEcosystemGraph({ resources, overlaps });

    expect(edges[0]?.label).toBe("overlaps (unresolved)");
    expect(edges[0]?.animated).toBe(true);
    expect(edges[0]?.style).toMatchObject({
      strokeDasharray: "6 4",
    });
    expect(isOverlapResolved(overlaps[0]!)).toBe(false);
  });

  it("does not create non-overlap edge kinds", () => {
    const resources = emptyResources();
    resources.agent = [
      makeResource({ id: "claude:agent:a", name: "alpha" }),
      makeResource({ id: "claude:agent:b", name: "beta" }),
    ];
    resources.mcp_server = [
      makeResource({
        id: "claude:mcp_server:github",
        kind: "mcp_server",
        name: "github",
        resourceClass: RESOURCE_CLASS.MCP_JSON_CONFIG,
      }),
    ];

    const { edges } = layoutEcosystemGraph({ resources, overlaps: [] });
    expect(edges).toHaveLength(0);
  });

  it("lays kind blocks left to right on a single row", () => {
    const { nodes } = layoutEcosystemGraph({
      resources: emptyResources(),
      overlaps: [],
    });

    const blocks = ECOSYSTEM_BLOCK_ORDER.map((kind) =>
      nodes.find((node) => node.id === `block:${kind}`)!,
    );

    expect(blocks.every((block) => block.position.y === 0)).toBe(true);
    for (let index = 1; index < blocks.length; index += 1) {
      const previous = blocks[index - 1]!;
      const current = blocks[index]!;
      expect(current.position.x).toBeGreaterThan(previous.position.x);
      expect(current.position.x).toBe((previous.style?.width as number) + previous.position.x + 56);
    }
  });

  it("spaces resource rows by at least the node height plus grid gap", () => {
    const resources = emptyResources();
    resources.skill = Array.from({ length: 5 }, (_, index) =>
      makeResource({
        id: `claude:skill:skill-${index}`,
        kind: "skill",
        name: `skill-${index}`,
        resourceClass: RESOURCE_CLASS.SKILL_DIRECTORY,
      }),
    );

    const { nodes } = layoutEcosystemGraph({ resources, overlaps: [] });
    const skillNodes = nodes
      .filter((node) => node.type === "ecosystemResource" && node.parentId === "block:skill")
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);

    expect(skillNodes).toHaveLength(5);
    expect(skillNodes[0]!.style).toMatchObject({ width: 172, height: 150 });

    const firstRowY = skillNodes[0]!.position.y;
    const secondRowY = skillNodes[3]!.position.y;
    expect(secondRowY - firstRowY).toBe(164);
  });

  it("marks resource nodes as non-draggable", () => {
    const resources = emptyResources();
    resources.instruction = [
      makeResource({
        id: "cursor:instruction:agents-md",
        kind: "instruction",
        platform: "cursor",
        name: "AGENTS.md",
        resourceClass: RESOURCE_CLASS.INSTRUCTION_AGENTS_MD,
      }),
    ];

    const { nodes } = layoutEcosystemGraph({ resources, overlaps: [] });
    const resourceNode = nodes.find((node) => node.type === "ecosystemResource");
    expect(resourceNode?.draggable).toBe(false);
  });
});
