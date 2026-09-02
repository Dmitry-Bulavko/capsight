import { describe, expect, it } from "vitest";
import type { InspectionGraph } from "../../src/core/graph/build-graph.js";
import { buildExecutionContext } from "../../src/adapters/claude/resolution/context.js";
import { layoutInspectionGraph } from "../../src/ui/graph-layout.js";

function makeGraph(overrides: Partial<InspectionGraph> = {}): InspectionGraph {
  const tools = Array.from({ length: 8 }, (_, index) => ({
    id: `tool:Tool${index}`,
    kind: "tool" as const,
    label: `Tool${index}`,
  }));

  return {
    context: buildExecutionContext("background-subagent"),
    nodes: [{ id: "agent:main", kind: "agent", label: "implementer" }, ...tools],
    edges: tools.map((tool) => ({
      id: `agent:main->${tool.id}`,
      source: "agent:main",
      target: tool.id,
      kind: "agent-tool" as const,
    })),
    ...overrides,
  };
}

describe("layoutInspectionGraph", () => {
  it("arranges tools in multiple columns instead of one long stack", () => {
    const { nodes } = layoutInspectionGraph(makeGraph());
    const toolNodes = nodes.filter((node) => node.data.kind === "tool");
    const xs = new Set(toolNodes.map((node) => node.position.x));

    expect(toolNodes.length).toBe(8);
    expect(xs.size).toBeGreaterThan(1);
  });

  it("vertically centers the agent lane relative to taller tool grid", () => {
    const { nodes } = layoutInspectionGraph(makeGraph());
    const agent = nodes.find((node) => node.data.kind === "agent");
    const tools = nodes.filter((node) => node.data.kind === "tool");

    expect(agent).toBeDefined();
    const minToolY = Math.min(...tools.map((node) => node.position.y));
    const maxToolY = Math.max(...tools.map((node) => node.position.y));
    const toolMidY = (minToolY + maxToolY) / 2;
    const agentHeight = Number(agent!.style?.height ?? 150);
    const agentMidY = agent!.position.y + agentHeight / 2;

    expect(Math.abs(agentMidY - toolMidY)).toBeLessThan(40);
  });

  it("hides repetitive agent-tool edge labels when there are many links", () => {
    const { edges } = layoutInspectionGraph(makeGraph());
    expect(edges.every((edge) => edge.label === undefined)).toBe(true);
  });

  it("keeps edge labels for small graphs", () => {
    const graph = makeGraph({
      nodes: [
        { id: "agent:main", kind: "agent", label: "implementer" },
        { id: "tool:Read", kind: "tool", label: "Read" },
      ],
      edges: [
        {
          id: "agent:main->tool:Read",
          source: "agent:main",
          target: "tool:Read",
          kind: "agent-tool",
        },
      ],
    });

    const { edges } = layoutInspectionGraph(graph);
    expect(edges[0]?.label).toBe("agent-tool");
  });

  it("uses ecosystem-sized agent nodes with platform metadata", () => {
    const { nodes } = layoutInspectionGraph(
      makeGraph({
        nodes: [
          {
            id: "agent:main",
            kind: "agent",
            label: "implementer",
            platform: "claude",
            scope: "project",
          },
          { id: "tool:Read", kind: "tool", label: "Read" },
        ],
        edges: [
          {
            id: "agent:main->tool:Read",
            source: "agent:main",
            target: "tool:Read",
            kind: "agent-tool",
          },
        ],
      }),
    );

    const agent = nodes.find((node) => node.data.kind === "agent");
    expect(agent?.style?.width).toBe(172);
    expect(agent?.style?.height).toBe(150);
    expect(agent?.data).toMatchObject({
      label: "implementer",
      platform: "claude",
      scope: "project",
    });
  });

  it("uses compact capability nodes with transparent react-flow wrappers", () => {
    const { nodes } = layoutInspectionGraph(makeGraph());
    const tool = nodes.find((node) => node.data.kind === "tool");

    expect(tool?.style).toMatchObject({
      width: 172,
      height: 68,
      padding: 0,
      background: "transparent",
      border: "none",
    });
  });
});
