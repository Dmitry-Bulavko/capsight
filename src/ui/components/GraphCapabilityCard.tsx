import type { GraphNodeKind } from "../../core/graph/build-graph.js";
import {
  formatGraphNodeKind,
  graphNodeKindColor,
  graphNodeKindGlow,
  graphNodeKindHint,
} from "../graph-node-kinds.js";
import { GraphNodeKindIcon } from "./GraphNodeKindIcon.js";

interface GraphCapabilityCardProps {
  kind: GraphNodeKind;
  label: string;
}

export function GraphCapabilityCard({ kind, label }: GraphCapabilityCardProps) {
  const kindColor = graphNodeKindColor(kind);
  const hint = graphNodeKindHint(kind);

  return (
    <div
      className="graph-capability-card"
      style={{
        borderColor: kindColor,
        boxShadow: graphNodeKindGlow(kind),
      }}
      title={label}
    >
      <header className="graph-capability-card-header">
        <span className="graph-capability-card-kind">{formatGraphNodeKind(kind)}</span>
        <span className="graph-capability-card-kind-icon" title={hint} aria-label={hint}>
          <GraphNodeKindIcon kind={kind} />
        </span>
      </header>
      <div className="graph-capability-card-label">{label}</div>
    </div>
  );
}
