import type { GraphNodeKind } from "../../core/graph/build-graph.js";
import { EcosystemBlockKindIcon } from "./EcosystemBlockKindIcon.js";
import { graphNodeKindColor } from "../graph-node-kinds.js";

interface GraphNodeKindIconProps {
  kind: GraphNodeKind;
}

export function GraphNodeKindIcon({ kind }: GraphNodeKindIconProps) {
  if (kind === "skill" || kind === "mcp_server" || kind === "instruction") {
    return <EcosystemBlockKindIcon kind={kind} />;
  }

  const color = graphNodeKindColor(kind);

  return (
    <span
      className="ecosystem-block-kind-icon"
      style={{ color, borderColor: `${color}66`, backgroundColor: `${color}18` }}
      aria-hidden="true"
    >
      <GraphNodeKindGlyph kind={kind} />
    </span>
  );
}

function GraphNodeKindGlyph({ kind }: GraphNodeKindIconProps) {
  switch (kind) {
    case "agent":
      return (
        <svg viewBox="0 0 16 16" width="14" height="14">
          <circle cx="8" cy="5.2" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            d="M4.2 13c.8-2.2 2.3-3.2 3.8-3.2s3 1 3.8 3.2"
          />
        </svg>
      );
    case "tool":
      return (
        <svg viewBox="0 0 16 16" width="14" height="14">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            d="M4.5 4.8 11.5 11.8M6.2 3.2l1.1 1.1-1.4 1.4-1.1-1.1L6.2 3.2Zm5.6 5.6 1.1 1.1-1.4 1.4-1.1-1.1 1.4-1.4Z"
          />
        </svg>
      );
    case "mcp_tool":
      return (
        <svg viewBox="0 0 16 16" width="14" height="14">
          <rect
            x="3.2"
            y="4.2"
            width="9.6"
            height="7.6"
            rx="1.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <path stroke="currentColor" strokeWidth="1.2" d="M3.2 6.8h9.6" />
          <circle cx="5.2" cy="5.6" r="0.55" fill="currentColor" />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
            d="M8 9.2h2.4"
          />
        </svg>
      );
    default:
      return null;
  }
}
