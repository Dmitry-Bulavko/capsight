import type { WorkflowLabGraph } from "./workflow-lab-types.js";
import { agentSystemBinding } from "./workflow-lab-types.js";

/** Block-type catalog — all node/edge variants for design reference. */
export const WORKFLOW_LAB_CATALOG: WorkflowLabGraph = {
  nodes: [
    {
      id: "wf-md-roadmap",
      kind: "markdown_file",
      label: "ROADMAP.md",
      agentSystems: [
        agentSystemBinding("claude-code", "available"),
        agentSystemBinding("cursor", "available"),
        agentSystemBinding("opencode", "available"),
      ],
    },
    {
      id: "wf-instruction",
      kind: "instruction",
      label: "CLAUDE.md",
      agentSystems: [
        agentSystemBinding("claude-code", "available"),
        agentSystemBinding("cursor", "unavailable"),
        agentSystemBinding("codex", "unknown"),
        agentSystemBinding("antigravity", "unavailable"),
        agentSystemBinding("cline", "unavailable"),
        agentSystemBinding("devin", "unavailable"),
        agentSystemBinding("opencode", "unknown"),
      ],
    },
    {
      id: "wf-agent-main",
      kind: "agent",
      label: "orchestrator",
      agentSystems: [
        agentSystemBinding("claude-code", "available"),
        agentSystemBinding("cursor", "available"),
        agentSystemBinding("codex", "unavailable"),
        agentSystemBinding("antigravity", "available"),
        agentSystemBinding("cline", "available"),
        agentSystemBinding("devin", "unknown"),
        agentSystemBinding("opencode", "available"),
      ],
    },
    {
      id: "wf-tool",
      kind: "tool",
      label: "Read",
      agentSystems: [
        agentSystemBinding("claude-code", "available"),
        agentSystemBinding("cursor", "available"),
        agentSystemBinding("codex", "available"),
        agentSystemBinding("antigravity", "available"),
        agentSystemBinding("cline", "available"),
        agentSystemBinding("devin", "available"),
        agentSystemBinding("opencode", "available"),
      ],
    },
    {
      id: "wf-mcp-server",
      kind: "mcp_server",
      label: "github",
      agentSystems: [
        agentSystemBinding("claude-code", "available"),
        agentSystemBinding("cursor", "available"),
        agentSystemBinding("codex", "unavailable"),
        agentSystemBinding("antigravity", "unknown"),
        agentSystemBinding("cline", "available"),
        agentSystemBinding("devin", "unavailable"),
        agentSystemBinding("opencode", "available"),
      ],
    },
    {
      id: "wf-mcp-tool",
      kind: "mcp_tool",
      label: "merge_pr",
      agentSystems: [
        agentSystemBinding("claude-code", "available"),
        agentSystemBinding("cursor", "unavailable"),
        agentSystemBinding("codex", "unavailable"),
        agentSystemBinding("antigravity", "unavailable"),
        agentSystemBinding("cline", "unavailable"),
        agentSystemBinding("devin", "unavailable"),
        agentSystemBinding("opencode", "unknown"),
      ],
    },
    {
      id: "wf-skill",
      kind: "skill",
      label: "code-review",
      agentSystems: [
        agentSystemBinding("claude-code", "available"),
        agentSystemBinding("cursor", "available"),
        agentSystemBinding("codex", "unknown"),
        agentSystemBinding("antigravity", "available"),
        agentSystemBinding("cline", "available"),
        agentSystemBinding("devin", "unknown"),
        agentSystemBinding("opencode", "available"),
      ],
    },
    {
      id: "wf-code-scan",
      kind: "code_file",
      label: "scan.ts",
      agentSystems: [
        agentSystemBinding("claude-code", "available"),
        agentSystemBinding("cursor", "available"),
        agentSystemBinding("codex", "unavailable"),
        agentSystemBinding("opencode", "available"),
      ],
    },
    {
      id: "wf-md-agent",
      kind: "markdown_file",
      label: "implementer.md",
      agentSystems: [
        agentSystemBinding("claude-code", "available"),
        agentSystemBinding("cursor", "available"),
        agentSystemBinding("cline", "available"),
      ],
    },
    {
      id: "wf-code-hook",
      kind: "code_file",
      label: "log.mjs",
      agentSystems: [
        agentSystemBinding("claude-code", "available"),
        agentSystemBinding("cursor", "unknown"),
        agentSystemBinding("codex", "unavailable"),
      ],
    },
  ],
  edges: [
    { id: "wf-edge-md-roadmap", source: "wf-md-roadmap", target: "wf-instruction", kind: "agent-instruction" },
    { id: "wf-edge-tool", source: "wf-agent-main", target: "wf-tool", kind: "agent-tool" },
    { id: "wf-edge-mcp-server", source: "wf-agent-main", target: "wf-mcp-server", kind: "agent-mcp-server" },
    { id: "wf-edge-mcp-tool", source: "wf-mcp-server", target: "wf-mcp-tool", kind: "mcp-server-mcp-tool" },
    { id: "wf-edge-skill", source: "wf-agent-main", target: "wf-skill", kind: "agent-skill" },
    { id: "wf-edge-instruction", source: "wf-instruction", target: "wf-agent-main", kind: "agent-instruction" },
    { id: "wf-edge-md-agent", source: "wf-agent-main", target: "wf-md-agent", kind: "agent-markdown-file" },
    { id: "wf-edge-code-scan", source: "wf-agent-main", target: "wf-code-scan", kind: "agent-code-file" },
    { id: "wf-edge-code-hook", source: "wf-mcp-server", target: "wf-code-hook", kind: "agent-code-file" },
  ],
};
