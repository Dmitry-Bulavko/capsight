import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RESOURCE_CLASS } from "../../src/core/compat/resource-class.js";
import type { InventoryResourceKind } from "../../src/core/model/ecosystem.js";
import type { InventoryResourceWithCompat } from "../../src/server/routes/ecosystem.js";
import {
  buildPlatformFilterOptions,
  PLATFORM_FILTER_ALL,
  PlatformFilter,
} from "../../src/ui/components/PlatformFilter.js";
import {
  countDimmedResources,
  isResourceDimmed,
  layoutEcosystemGraph,
} from "../../src/ui/ecosystem-layout.js";

function noop(): void {}

function makeResource(
  overrides: Partial<InventoryResourceWithCompat> & Pick<InventoryResourceWithCompat, "id">,
): InventoryResourceWithCompat {
  const kind = overrides.kind ?? "agent";
  return {
    platform: "claude",
    scope: "project",
    resourceClass: RESOURCE_CLASS.AGENT_MARKDOWN,
    name: overrides.id.split(":").pop(),
    compat: {
      claude: { support: "supported", enforcement: "enforced", matrixRef: "compat.claude.agent-markdown" },
      cursor: { support: "supported", enforcement: "enforced", matrixRef: "compat.cursor.agent-markdown" },
      codex: { support: "not-supported", enforcement: "enforced", matrixRef: "compat.codex.agent-markdown", reason: "Codex does not read markdown agent files." },
    },
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

describe("PlatformFilter", () => {
  it("lists All plus every platform and marks not-detected platforms", () => {
    const options = buildPlatformFilterOptions([
      { platform: "claude", status: "detected", evidence: [] },
      { platform: "cursor", status: "not-detected", evidence: [] },
      { platform: "codex", status: "not-detected", evidence: [] },
    ]);

    expect(options.map((option) => option.value)).toEqual(["all", "claude", "cursor", "codex"]);
    expect(options[0]?.label).toBe("All platforms");

    const cursor = options.find((option) => option.value === "cursor");
    expect(cursor?.badge).toEqual({ text: "not detected", tone: "unknown" });
    expect(cursor?.ariaLabel).toMatch(/not detected/i);
  });

  it("renders with All platforms as the default selection", () => {
    const html = renderToString(
      createElement(PlatformFilter, {
        detection: [
          { platform: "claude", status: "detected", evidence: [] },
          { platform: "cursor", status: "not-detected", evidence: [] },
          { platform: "codex", status: "not-detected", evidence: [] },
        ],
        value: PLATFORM_FILTER_ALL,
        onChange: noop,
      }),
    );

    expect(html).toContain('data-testid="platform-filter"');
    expect(html).toContain("All platforms");
    expect(html).not.toContain("platform-filter-summary");
  });

  it("shows dimmed count when a specific platform is selected", () => {
    const html = renderToString(
      createElement(PlatformFilter, {
        detection: [{ platform: "claude", status: "detected", evidence: [] }],
        value: "codex",
        onChange: noop,
        dimmedCount: 2,
      }),
    );

    expect(html).toContain('data-testid="platform-filter-summary"');
    expect(html).toContain("2 dimmed");
    expect(html).toContain("not consumed");
  });
});

describe("platform filter layout semantics", () => {
  it("dims non-consumed resources instead of removing them", () => {
    const resources = emptyResources();
    resources.agent = [
      makeResource({ id: "claude:agent:backend", name: "backend" }),
      makeResource({
        id: "cursor:instruction:agents-md",
        kind: "instruction",
        platform: "cursor",
        resourceClass: RESOURCE_CLASS.INSTRUCTION_AGENTS_MD,
        name: "AGENTS.md",
        compat: {
          claude: {
            support: "not-supported",
            enforcement: "enforced",
            matrixRef: "compat.claude.instruction-agents-md",
            reason: "Claude Code does not read AGENTS.md.",
          },
          cursor: {
            support: "supported",
            enforcement: "enforced",
            matrixRef: "compat.cursor.instruction-agents-md",
          },
          codex: {
            support: "supported",
            enforcement: "enforced",
            matrixRef: "compat.codex.instruction-agents-md",
          },
        },
      }),
    ];

    const { nodes, dimmedCount } = layoutEcosystemGraph({
      resources,
      overlaps: [],
      filterPlatform: "claude",
    });

    const resourceNodes = nodes.filter((node) => node.type === "ecosystemResource");
    expect(resourceNodes).toHaveLength(2);
    expect(dimmedCount).toBe(1);
    expect(countDimmedResources(resources, "claude")).toBe(1);

    const dimmedNode = resourceNodes.find((node) => node.data.dimmed === true);
    expect(dimmedNode?.id).toBe("cursor:instruction:agents-md");
    expect(dimmedNode?.className).toContain("ecosystem-resource-dimmed");
    expect(dimmedNode?.style).toMatchObject({ opacity: 0.38 });
  });

  it("does not dim unknown verdicts — only not-supported", () => {
    const compat = {
      claude: { support: "unknown" as const, enforcement: "unknown" as const },
      cursor: { support: "unknown" as const, enforcement: "unknown" as const },
      codex: { support: "unknown" as const, enforcement: "unknown" as const },
    };

    expect(isResourceDimmed(compat, "claude", "claude:agent:backend")).toBe(false);
  });

  it("keeps all resources undimmed in All platforms mode", () => {
    const resources = emptyResources();
    resources.agent = [makeResource({ id: "claude:agent:backend" })];

    const { dimmedCount } = layoutEcosystemGraph({
      resources,
      overlaps: [],
      filterPlatform: "all",
    });

    expect(dimmedCount).toBe(0);
  });
});
