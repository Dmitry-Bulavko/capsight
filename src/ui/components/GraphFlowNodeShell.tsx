import type { ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";

interface GraphFlowNodeShellProps {
  children: ReactNode;
}

/** Invisible connection points required by React Flow v12 custom nodes. */
export function GraphFlowNodeShell({ children }: GraphFlowNodeShellProps) {
  return (
    <div className="graph-flow-node-shell">
      <Handle
        type="target"
        position={Position.Left}
        id="target"
        className="graph-flow-handle"
        isConnectable={false}
      />
      {children}
      <Handle
        type="source"
        position={Position.Right}
        id="source"
        className="graph-flow-handle"
        isConnectable={false}
      />
    </div>
  );
}
