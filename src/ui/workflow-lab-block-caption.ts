import type { WorkflowBlockKind } from "./workflow-block-kinds.js";
import type { WorkflowLabNode } from "./workflow-lab-types.js";

export function workflowBlockCaption(node: WorkflowLabNode): string | undefined {
  if (node.caption !== undefined && node.caption.length > 0) {
    return node.caption;
  }

  switch (node.kind) {
    case "agent":
      return `@ ${node.label}.md`;
    case "markdown_file":
      return node.label;
    case "skill":
      return `.cursor/skills/${node.label}`;
    case "code_file":
      return `src/${node.label}`;
    case "mcp_server":
      return `mcp://${node.label}`;
    case "mcp_tool":
      return `${node.label}()`;
    case "instruction":
      return node.label;
    case "tool":
      return node.label;
    default:
      return undefined;
  }
}

export function workflowBlockKindLabel(kind: WorkflowBlockKind): string {
  return kind.replaceAll("_", " ");
}
