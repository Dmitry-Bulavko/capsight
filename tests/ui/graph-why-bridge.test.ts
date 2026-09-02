import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import {
  capabilityIdFromGraphNode,
  enhanceLayoutNodeForSelection,
  isGraphNodeSelectable,
} from "../../src/ui/components/GraphView.js";

describe("graph capability selection helpers", () => {
  it("maps capability-bearing node kinds to capability ids", () => {
    expect(capabilityIdFromGraphNode("tool", "Read")).toBe("Read");
    expect(capabilityIdFromGraphNode("mcp_tool", "mcp__github__merge_pr")).toBe(
      "mcp__github__merge_pr",
    );
    expect(capabilityIdFromGraphNode("skill", "skill:lint")).toBe("skill:lint");
    expect(capabilityIdFromGraphNode("instruction", "CLAUDE.md")).toBe("CLAUDE.md");
  });

  it("marks agent and mcp_server nodes as non-selectable", () => {
    expect(isGraphNodeSelectable("agent")).toBe(false);
    expect(isGraphNodeSelectable("mcp_server")).toBe(false);
    expect(capabilityIdFromGraphNode("agent", "implementer")).toBeNull();
    expect(capabilityIdFromGraphNode("mcp_server", "github")).toBeNull();
  });

  it("enhances layout nodes with selection and interactivity classes", () => {
    const toolNode: Node = {
      id: "tool:Read",
      position: { x: 0, y: 0 },
      data: { kind: "tool", label: "Read" },
    };
    const agentNode: Node = {
      id: "agent:main",
      position: { x: 0, y: 0 },
      data: { kind: "agent", label: "implementer" },
    };

    const selectedTool = enhanceLayoutNodeForSelection(toolNode, "Read");
    const unselectedTool = enhanceLayoutNodeForSelection(toolNode, null);
    const agent = enhanceLayoutNodeForSelection(agentNode, null);

    expect(selectedTool.className).toBe("graph-node-capability");
    expect(selectedTool.selectable).toBe(true);
    expect(selectedTool.selected).toBe(true);

    expect(unselectedTool.selected).toBe(false);

    expect(agent.className).toBe("graph-node-agent");
    expect(agent.selectable).toBe(false);
    expect(agent.selected).toBe(false);
  });
});
