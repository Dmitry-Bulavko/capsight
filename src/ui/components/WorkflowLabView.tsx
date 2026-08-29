import { useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { WORKFLOW_EDGE_LEGEND } from "../workflow-block-kinds.js";
import { WORKFLOW_LAB_MOCK } from "../workflow-lab-mock.js";
import {
  formatNodeKind,
  layoutWorkflowLabGraph,
  nodeKindColor,
  WORKFLOW_NODE_KINDS,
} from "../workflow-lab-layout.js";
import {
  workflowEdgeColor,
  workflowEdgeShortLabel,
} from "../workflow-block-kinds.js";
import { WorkflowBlockKindIcon } from "./WorkflowBlockKindIcon.js";
import { workflowBlockNodeTypes } from "./WorkflowBlockCard.js";
import { workflowSwimlaneGroupTypes } from "./WorkflowSwimlaneGroup.js";

export function WorkflowLabView() {
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const nodeTypes = useMemo(
    () => ({
      ...workflowBlockNodeTypes(),
      ...workflowSwimlaneGroupTypes(),
    }),
    [],
  );

  const { nodes, edges } = useMemo(() => layoutWorkflowLabGraph(WORKFLOW_LAB_MOCK), []);

  useEffect(() => {
    if (!flowInstance || nodes.length === 0) return;
    const frame = requestAnimationFrame(() => {
      void flowInstance.fitView({ padding: 0.14, duration: 280, maxZoom: 0.88 });
    });
    return () => cancelAnimationFrame(frame);
  }, [flowInstance, nodes]);

  const nodeLegendItems = useMemo(
    () =>
      WORKFLOW_NODE_KINDS.map((kind) => {
        const sample = WORKFLOW_LAB_MOCK.nodes.find((node) => node.kind === kind);
        return {
          kind,
          label: sample?.label ?? kind,
        };
      }),
    [],
  );

  const activeEdgeLegend = useMemo(() => {
    const kinds = new Set(WORKFLOW_LAB_MOCK.edges.map((edge) => edge.kind));
    return WORKFLOW_EDGE_LEGEND.filter((item) => kinds.has(item.kind));
  }, []);

  return (
    <section className="panel workflow-lab-panel">
      <div className="workflow-lab-header">
        <h2>Workflow Lab</h2>
        <span className="workflow-lab-badge">Preview / temporary</span>
      </div>
      <p className="workflow-lab-note">
        Reference-style workflow canvas — hub skill, agent stream groups, curved edges with semantic
        labels. Main dashboard unchanged; this tab is a design sandbox only.
      </p>

      <div className="workflow-lab-container" data-testid="workflow-lab-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onInit={setFlowInstance}
          minZoom={0.35}
          maxZoom={1.2}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          edgesFocusable={false}
          elevateEdgesOnSelect={false}
          panOnDrag
          zoomOnScroll
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={28} color="#2a2e36" />
          <Controls showInteractive={false} position="bottom-left" />
          <MiniMap
            className="workflow-lab-minimap"
            position="bottom-right"
            nodeColor={(node) => {
              const kind = (node.data as { kind?: string } | undefined)?.kind;
              return kind ? nodeKindColor(kind as Parameters<typeof nodeKindColor>[0]) : "#5f6368";
            }}
            maskColor="rgba(15, 17, 22, 0.72)"
            pannable
            zoomable
          />
        </ReactFlow>

        <div className="workflow-lab-canvas-legend" aria-label="Workflow legend">
          <div className="workflow-lab-canvas-legend-section">
            <span className="workflow-lab-canvas-legend-heading">Nodes</span>
            <ul className="workflow-lab-canvas-legend-list">
              {nodeLegendItems.map((item) => (
                <li key={item.kind}>
                  <WorkflowBlockKindIcon kind={item.kind} />
                  <span>{formatNodeKind(item.kind)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="workflow-lab-canvas-legend-section">
            <span className="workflow-lab-canvas-legend-heading">Relationships</span>
            <ul className="workflow-lab-canvas-legend-list">
              {activeEdgeLegend.map((item) => (
                <li key={item.kind}>
                  <span
                    className="workflow-lab-canvas-legend-edge"
                    style={{ backgroundColor: workflowEdgeColor(item.kind) }}
                  />
                  <span>{workflowEdgeShortLabel(item.kind)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
