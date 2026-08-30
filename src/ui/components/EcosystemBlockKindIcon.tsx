import type { InventoryResourceKind } from "../../core/model/ecosystem.js";
import { ecosystemBlockKindColor } from "../ecosystem-block-kinds.js";

interface EcosystemBlockKindIconProps {
  kind: InventoryResourceKind;
}

export function EcosystemBlockKindIcon({ kind }: EcosystemBlockKindIconProps) {
  const color = ecosystemBlockKindColor(kind);

  return (
    <span
      className="ecosystem-block-kind-icon"
      style={{ color, borderColor: `${color}66`, backgroundColor: `${color}18` }}
      aria-hidden="true"
    >
      <BlockKindGlyph kind={kind} />
    </span>
  );
}

function BlockKindGlyph({ kind }: EcosystemBlockKindIconProps) {
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
    case "skill":
      return (
        <svg viewBox="0 0 16 16" width="14" height="14">
          <path
            fill="currentColor"
            d="M8 2.2 9.1 5.7 12.8 5.8 9.9 8 10.9 11.5 8 9.6 5.1 11.5 6.1 8 3.2 5.8 6.9 5.7 8 2.2Z"
          />
        </svg>
      );
    case "mcp_server":
      return (
        <svg viewBox="0 0 16 16" width="14" height="14">
          <rect
            x="3"
            y="3"
            width="10"
            height="10"
            rx="1.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <path stroke="currentColor" strokeWidth="1.2" d="M3 6.2h10M3 9.2h10" />
          <circle cx="5" cy="4.6" r="0.55" fill="currentColor" />
        </svg>
      );
    case "instruction":
      return (
        <svg viewBox="0 0 16 16" width="14" height="14">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            d="M4.5 2.8h7a1.2 1.2 0 0 1 1.2 1.2v8.4H5.7L4.5 10.4V4a1.2 1.2 0 0 1 1.2-1.2Z"
          />
          <path stroke="currentColor" strokeWidth="1.1" d="M6.2 5.8h5M6.2 8h4.2M6.2 10.2h3.2" />
        </svg>
      );
  }
}
