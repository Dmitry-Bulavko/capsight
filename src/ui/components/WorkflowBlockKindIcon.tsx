import type { WorkflowBlockKind } from "../workflow-block-kinds.js";
import { workflowBlockKindColor } from "../workflow-block-kinds.js";

interface WorkflowBlockKindIconProps {
  kind: WorkflowBlockKind;
}

export function WorkflowBlockKindIcon({ kind }: WorkflowBlockKindIconProps) {
  const color = workflowBlockKindColor(kind);

  return (
    <span
      className="workflow-block-kind-icon"
      style={{ color, borderColor: `${color}66`, backgroundColor: `${color}18` }}
      aria-hidden="true"
    >
      <BlockKindGlyph kind={kind} />
    </span>
  );
}

function BlockKindGlyph({ kind }: WorkflowBlockKindIconProps) {
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
            d="M10.2 3.2 6.4 7c-.8.8-.8 2 0 2.8.8.8 2 .8 2.8 0l3.8-3.8a2.2 2.2 0 0 0-3-3Z"
          />
          <path fill="currentColor" d="M3.2 11.6 4.4 12.8 2.4 14.8 1.2 13.6 3.2 11.6Z" />
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
    case "mcp_tool":
      return (
        <svg viewBox="0 0 16 16" width="14" height="14">
          <rect
            x="2.8"
            y="2.8"
            width="5.2"
            height="5.2"
            rx="1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
            d="M8 5.4h2.8a2.2 2.2 0 0 1 0 4.4H8v3.2"
          />
          <circle cx="12.4" cy="9.8" r="1.1" fill="currentColor" />
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
    case "markdown_file":
      return (
        <svg viewBox="0 0 16 16" width="14" height="14">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            d="M4.8 2.6h4.3L12.4 5.9v7.5a1 1 0 0 1-1 1H4.8a1 1 0 0 1-1-1V3.6a1 1 0 0 1 1-1Z"
          />
          <path stroke="currentColor" strokeWidth="1.1" d="M9.1 2.8v3.1h3.3" />
          <path
            fill="currentColor"
            d="M5.4 8.2h4.8v1H5.4v-1Zm0 2.2h3.4v1H5.4v-1Z"
          />
          <path stroke="currentColor" strokeWidth="1.1" d="M5.4 7.1h2.6" />
        </svg>
      );
    case "code_file":
      return (
        <svg viewBox="0 0 16 16" width="14" height="14">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            d="M4.8 2.6h4.3L12.4 5.9v7.5a1 1 0 0 1-1 1H4.8a1 1 0 0 1-1-1V3.6a1 1 0 0 1 1-1Z"
          />
          <path stroke="currentColor" strokeWidth="1.1" d="M9.1 2.8v3.1h3.3" />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            d="M6.1 8.2 4.8 9.5l1.3 1.3M9.9 8.2l1.3 1.3-1.3 1.3"
          />
        </svg>
      );
  }
}
