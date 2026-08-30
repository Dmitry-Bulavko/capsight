import { useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
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

interface GraphViewProps {
  context: ContextPreset;
}

export function GraphView({ context }: GraphViewProps) {
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
      nodes: laidOut.nodes.map((node) => ({ ...node, type: "default" as const })),
      edges: laidOut.edges,
    };
  }, [graph]);

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
