import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  type Node,
  type NodeMouseHandler,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { ContextPreset } from "../../core/model/index.js";
import type { InspectionGraph } from "../../core/graph/build-graph.js";
import { fetchGraph } from "../api.js";
import {
  GRAPH_LEGEND_ITEMS,
  edgeLegendColor,
  edgeLegendLabel,
  layoutInspectionGraph,
} from "../graph-layout.js";
import { graphNodeTypes } from "./GraphNodeCard.js";

const SELECTABLE_NODE_KINDS = new Set(["tool", "mcp_tool", "skill", "instruction"]);

export function isGraphNodeSelectable(kind: string): boolean {
  return SELECTABLE_NODE_KINDS.has(kind);
}

export function capabilityIdFromGraphNode(kind: string, label: string): string | null {
  return isGraphNodeSelectable(kind) ? label : null;
}

export function enhanceLayoutNodeForSelection(
  node: Node,
  selectedCapabilityId: string | null,
): Node {
  const capabilityId = capabilityIdFromGraphNode(
    String(node.data.kind),
    String(node.data.label),
  );
  const selectable = capabilityId !== null;

  return {
    ...node,
    className: selectable ? "graph-node-capability" : "graph-node-non-interactive",
    selectable,
    selected: selectable && capabilityId === selectedCapabilityId,
  };
}

interface GraphViewProps {
  context: ContextPreset;
  selectedCapabilityId: string | null;
  onSelectCapability: (capabilityId: string) => void;
}

export function GraphView({
  context,
  selectedCapabilityId,
  onSelectCapability,
}: GraphViewProps) {
  const [graph, setGraph] = useState<InspectionGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const nodeTypes = useMemo(() => graphNodeTypes(), []);

  useEffect(() => {
    let cancelled = false;

    async function loadGraph() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchGraph(context);
        if (!cancelled) {
          setGraph(result);
        }
      } catch (err) {
        if (!cancelled) {
          setGraph(null);
          setError(err instanceof Error ? err.message : "Failed to load graph");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadGraph();
    return () => {
      cancelled = true;
    };
  }, [context]);

  const { nodes, edges } = useMemo(() => {
    if (!graph) {
      return { nodes: [], edges: [] };
    }
    const laidOut = layoutInspectionGraph(graph);
    return {
      nodes: laidOut.nodes.map((node) =>
        enhanceLayoutNodeForSelection({ ...node, type: "default" as const }, selectedCapabilityId),
      ),
      edges: laidOut.edges,
    };
  }, [graph, selectedCapabilityId]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      const capabilityId = capabilityIdFromGraphNode(
        String(node.data.kind),
        String(node.data.label),
      );
      if (capabilityId) {
        onSelectCapability(capabilityId);
      }
    },
    [onSelectCapability],
  );

  useEffect(() => {
    if (!flowInstance || nodes.length === 0) return;
    const frame = requestAnimationFrame(() => {
      void flowInstance.fitView({ padding: 0.12, duration: 200 });
    });
    return () => cancelAnimationFrame(frame);
  }, [flowInstance, nodes]);

  const activeLegendItems = useMemo(() => {
    if (!graph) return [];
    const kinds = new Set(graph.edges.map((edge) => edge.kind));
    return GRAPH_LEGEND_ITEMS.filter((item) => kinds.has(item.kind));
  }, [graph]);

  return (
    <section className="panel graph-panel">
      <h2>Inspection graph</h2>
      <p className="graph-note">Effective resolution — one context</p>

      {activeLegendItems.length > 0 && (
        <ul className="graph-legend" aria-label="Edge types">
          {activeLegendItems.map((item) => (
            <li key={item.kind}>
              <span
                className="graph-legend-swatch"
                style={{ backgroundColor: edgeLegendColor(item.kind) }}
              />
              {edgeLegendLabel(item.kind)}
            </li>
          ))}
        </ul>
      )}

      {loading && <p className="empty-state">Loading graph…</p>}
      {!loading && error && <p className="error-message">{error}</p>}

      {!loading && !error && graph && (
        <>
          {graph.nodes.length === 0 ? (
            <p className="empty-state">No graph nodes for this context.</p>
          ) : (
            <div className="graph-container" data-testid="inspection-graph">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onInit={setFlowInstance}
                onNodeClick={handleNodeClick}
                minZoom={0.35}
                maxZoom={1.5}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable
                panOnDrag
                zoomOnScroll
                proOptions={{ hideAttribution: true }}
              >
                <Background gap={16} color="#3c4043" />
                <Controls showInteractive={false} />
              </ReactFlow>
            </div>
          )}
        </>
      )}
    </section>
  );
}
