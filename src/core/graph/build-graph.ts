import type {
  EffectiveConfiguration,
  ExecutionContext,
  ProjectSnapshot,
  ResolvedCapability,
} from "../model/index.js";
import type { PlatformToolTables } from "../resolver/tool-tables.js";

export type GraphNodeKind =
  | "agent"
  | "tool"
  | "mcp_server"
  | "mcp_tool"
  | "skill"
  | "instruction";

export type GraphEdgeKind =
  | "agent-tool"
  | "agent-mcp-server"
  | "mcp-server-mcp-tool"
  | "agent-skill"
  | "agent-instruction"
  | "agent-agent";

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: GraphEdgeKind;
}

export interface InspectionGraph {
  context: ExecutionContext;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface BuildGraphInput {
  snapshot: ProjectSnapshot;
  context: ExecutionContext;
  effectiveByAgent: ReadonlyMap<string, EffectiveConfiguration>;
  /** Tool tables supplied by the platform adapter (§12.2). */
  toolTables: PlatformToolTables;
}

function agentNodeId(agentId: string): string {
  return `agent:${agentId}`;
}

function toolNodeId(toolName: string): string {
  return `tool:${toolName}`;
}

function mcpServerNodeId(serverId: string): string {
  return `mcp-server:${serverId}`;
}

function mcpToolNodeId(toolName: string): string {
  return `mcp-tool:${toolName}`;
}

function skillNodeId(skillId: string): string {
  return `skill:${skillId}`;
}

function instructionNodeId(instructionId: string): string {
  return `instruction:${instructionId}`;
}

function isLinkedCapability(capability: ResolvedCapability): boolean {
  return (
    capability.status === "available" ||
    capability.status === "preloaded" ||
    capability.status === "unknown"
  );
}

function mcpServerLabel(capabilityId: string): string {
  if (capabilityId.startsWith("mcp-server:")) {
    return capabilityId.slice("mcp-server:".length);
  }
  if (capabilityId.startsWith("inline-mcp:")) {
    return `inline #${capabilityId.slice("inline-mcp:".length)}`;
  }
  return capabilityId;
}

function mcpServerIdFromCapability(capabilityId: string): string {
  if (capabilityId.startsWith("mcp-server:")) {
    return capabilityId.slice("mcp-server:".length);
  }
  return capabilityId;
}

class GraphBuilder {
  private readonly nodes = new Map<string, GraphNode>();
  private readonly edges = new Map<string, GraphEdge>();

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
  }

  addEdge(edge: GraphEdge): void {
    this.edges.set(edge.id, edge);
  }

  build(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const sortById = <T extends { id: string }>(items: Iterable<T>): T[] =>
      [...items].sort((left, right) => left.id.localeCompare(right.id));

    return {
      nodes: sortById(this.nodes.values()),
      edges: sortById(this.edges.values()),
    };
  }
}

/**
 * Build an inspection graph from discovery snapshot and per-agent effective configs.
 * @see docs/SPEC.md §7.10
 */
export function buildInspectionGraph(input: BuildGraphInput): InspectionGraph {
  const { snapshot, context, effectiveByAgent, toolTables } = input;
  const agentToolNames = new Set(toolTables.agentToolNames);
  const builder = new GraphBuilder();
  const activeAgents = snapshot.agents.filter((agent) => agent.status === "active");

  for (const agent of activeAgents) {
    builder.addNode({
      id: agentNodeId(agent.id),
      kind: "agent",
      label: agent.name,
    });
  }

  const activeAgentIds = activeAgents.map((agent) => agent.id);

  for (const agent of activeAgents) {
    const effective = effectiveByAgent.get(agent.id);
    if (!effective) {
      continue;
    }

    const sourceId = agentNodeId(agent.id);
    let canSpawnAgents = false;

    for (const capability of effective.capabilities) {
      if (!isLinkedCapability(capability)) {
        continue;
      }

      switch (capability.kind) {
        case "tool": {
          const toolName = capability.capabilityId;
          builder.addNode({
            id: toolNodeId(toolName),
            kind: "tool",
            label: toolName,
          });
          builder.addEdge({
            id: `${sourceId}->${toolNodeId(toolName)}`,
            source: sourceId,
            target: toolNodeId(toolName),
            kind: "agent-tool",
          });

          if (agentToolNames.has(toolName)) {
            canSpawnAgents = true;
          }
          break;
        }

        case "mcp_tool": {
          const toolName = capability.capabilityId;
          builder.addNode({
            id: mcpToolNodeId(toolName),
            kind: "mcp_tool",
            label: toolName,
          });
          builder.addEdge({
            id: `${sourceId}->${mcpToolNodeId(toolName)}`,
            source: sourceId,
            target: mcpToolNodeId(toolName),
            kind: "agent-tool",
          });

          const serverId = toolTables.namespacedToolOwner(toolName);
          if (serverId) {
            const serverNodeId = mcpServerNodeId(serverId);
            builder.addNode({
              id: serverNodeId,
              kind: "mcp_server",
              label: serverId,
            });
            builder.addEdge({
              id: `${serverNodeId}->${mcpToolNodeId(toolName)}`,
              source: serverNodeId,
              target: mcpToolNodeId(toolName),
              kind: "mcp-server-mcp-tool",
            });
          }
          break;
        }

        case "mcp_server": {
          const serverId = mcpServerIdFromCapability(capability.capabilityId);
          const serverNodeId = mcpServerNodeId(serverId);
          builder.addNode({
            id: serverNodeId,
            kind: "mcp_server",
            label: mcpServerLabel(capability.capabilityId),
          });
          builder.addEdge({
            id: `${sourceId}->${serverNodeId}`,
            source: sourceId,
            target: serverNodeId,
            kind: "agent-mcp-server",
          });
          break;
        }

        case "skill": {
          const skillNode = skillNodeId(capability.capabilityId);
          builder.addNode({
            id: skillNode,
            kind: "skill",
            label: capability.capabilityId,
          });
          builder.addEdge({
            id: `${sourceId}->${skillNode}`,
            source: sourceId,
            target: skillNode,
            kind: "agent-skill",
          });
          break;
        }

        case "instruction": {
          const instructionNode = instructionNodeId(capability.capabilityId);
          builder.addNode({
            id: instructionNode,
            kind: "instruction",
            label: capability.capabilityId,
          });
          builder.addEdge({
            id: `${sourceId}->${instructionNode}`,
            source: sourceId,
            target: instructionNode,
            kind: "agent-instruction",
          });
          break;
        }

        default:
          break;
      }
    }

    if (canSpawnAgents) {
      for (const targetAgentId of activeAgentIds) {
        if (targetAgentId === agent.id) {
          continue;
        }

        const targetId = agentNodeId(targetAgentId);
        builder.addEdge({
          id: `${sourceId}->${targetId}:spawn`,
          source: sourceId,
          target: targetId,
          kind: "agent-agent",
        });
      }
    }
  }

  const built = builder.build();

  return {
    context,
    nodes: built.nodes,
    edges: built.edges,
  };
}

/**
 * Keep nodes and edges reachable from the selected agent.
 * Spawn targets (`agent-agent` edges) appear as leaf agent nodes without their subtrees.
 * @see docs/SPEC.md §7.10
 */
export function filterGraphToAgent(graph: InspectionGraph, agentId: string): InspectionGraph {
  const rootId = agentNodeId(agentId);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  if (!nodeById.has(rootId)) {
    return { ...graph, nodes: [], edges: [] };
  }

  const outgoing = new Map<string, GraphEdge[]>();
  for (const edge of graph.edges) {
    const edges = outgoing.get(edge.source) ?? [];
    edges.push(edge);
    outgoing.set(edge.source, edges);
  }

  const includedNodeIds = new Set<string>([rootId]);
  const includedEdgeIds = new Set<string>();
  const queue = [rootId];

  while (queue.length > 0) {
    const sourceId = queue.shift()!;
    for (const edge of outgoing.get(sourceId) ?? []) {
      includedEdgeIds.add(edge.id);

      const targetId = edge.target;
      if (edge.kind === "agent-agent" && targetId !== rootId) {
        includedNodeIds.add(targetId);
        continue;
      }

      if (!includedNodeIds.has(targetId)) {
        includedNodeIds.add(targetId);
        queue.push(targetId);
      }
    }
  }

  return {
    context: graph.context,
    nodes: graph.nodes.filter((node) => includedNodeIds.has(node.id)),
    edges: graph.edges.filter((edge) => includedEdgeIds.has(edge.id)),
  };
}

export const graphNodeIds = {
  agent: agentNodeId,
  tool: toolNodeId,
  mcpServer: mcpServerNodeId,
  mcpTool: mcpToolNodeId,
  skill: skillNodeId,
  instruction: instructionNodeId,
};
