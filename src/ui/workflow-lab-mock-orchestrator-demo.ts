import type { WorkflowLabEdge, WorkflowLabNode } from "./workflow-lab-types.js";
import { agentSystemBinding } from "./workflow-lab-types.js";

/** Pipeline agents — mostly Claude Code + Cursor in this demo. */
function pipelineAgent(): WorkflowLabNode["agentSystems"] {
  return [
    agentSystemBinding("claude-code", "available"),
    agentSystemBinding("cursor", "available"),
    agentSystemBinding("opencode", "available"),
    agentSystemBinding("antigravity", "unknown"),
    agentSystemBinding("codex", "unavailable"),
  ];
}

function agentMd(label: string): WorkflowLabNode["agentSystems"] {
  return [
    agentSystemBinding("claude-code", "available"),
    agentSystemBinding("cursor", "available"),
    agentSystemBinding("cline", "available"),
  ];
}

export const ORCHESTRATOR_DEMO_NODES: WorkflowLabNode[] = [
  {
    id: "demo-skill-orchestrator",
    kind: "skill",
    label: "capsight-orchestration",
    caption: ".cursor/skills/capsight-orchestration",
    agentSystems: [
      agentSystemBinding("claude-code", "available"),
      agentSystemBinding("cursor", "available"),
      agentSystemBinding("opencode", "available"),
    ],
  },
  {
    id: "demo-md-roadmap",
    kind: "markdown_file",
    label: "ROADMAP.md",
    agentSystems: [
      agentSystemBinding("claude-code", "available"),
      agentSystemBinding("cursor", "available"),
      agentSystemBinding("opencode", "available"),
    ],
  },
  {
    id: "demo-md-spec",
    kind: "markdown_file",
    label: "SPEC.md",
    agentSystems: [
      agentSystemBinding("claude-code", "available"),
      agentSystemBinding("cursor", "available"),
      agentSystemBinding("opencode", "available"),
    ],
  },
  {
    id: "demo-orchestrator",
    kind: "agent",
    label: "orchestrator",
    agentSystems: pipelineAgent(),
  },
  {
    id: "demo-md-orchestrator",
    kind: "markdown_file",
    label: "orchestrator.md",
    agentSystems: agentMd("orchestrator.md"),
  },
  {
    id: "demo-ba",
    kind: "agent",
    label: "business-analyst",
    agentSystems: pipelineAgent(),
  },
  {
    id: "demo-md-ba",
    kind: "markdown_file",
    label: "ba.md",
    agentSystems: agentMd("ba.md"),
  },
  {
    id: "demo-md-tasks",
    kind: "markdown_file",
    label: "TASKS.md",
    agentSystems: [
      agentSystemBinding("claude-code", "available"),
      agentSystemBinding("cursor", "available"),
    ],
  },
  {
    id: "demo-architect",
    kind: "agent",
    label: "architect",
    agentSystems: pipelineAgent(),
  },
  {
    id: "demo-md-architect",
    kind: "markdown_file",
    label: "architect.md",
    agentSystems: agentMd("architect.md"),
  },
  {
    id: "demo-md-handoff",
    kind: "markdown_file",
    label: "M4-01-handoff.md",
    agentSystems: [
      agentSystemBinding("claude-code", "available"),
      agentSystemBinding("cursor", "available"),
    ],
  },
  {
    id: "demo-implementer",
    kind: "agent",
    label: "implementer",
    agentSystems: pipelineAgent(),
  },
  {
    id: "demo-md-implementer",
    kind: "markdown_file",
    label: "implementer.md",
    agentSystems: agentMd("implementer.md"),
  },
  {
    id: "demo-code-reviewer",
    kind: "agent",
    label: "code-reviewer",
    agentSystems: pipelineAgent(),
  },
  {
    id: "demo-md-code-reviewer",
    kind: "markdown_file",
    label: "code-reviewer.md",
    agentSystems: agentMd("code-reviewer.md"),
  },
  {
    id: "demo-skill-review",
    kind: "skill",
    label: "code-review",
    agentSystems: [
      agentSystemBinding("claude-code", "available"),
      agentSystemBinding("cursor", "available"),
    ],
  },
  {
    id: "demo-spec-reviewer",
    kind: "agent",
    label: "spec-reviewer",
    agentSystems: pipelineAgent(),
  },
  {
    id: "demo-md-spec-reviewer",
    kind: "markdown_file",
    label: "spec-reviewer.md",
    agentSystems: agentMd("spec-reviewer.md"),
  },
  {
    id: "demo-pr-agent",
    kind: "agent",
    label: "pr-author",
    agentSystems: [
      agentSystemBinding("claude-code", "available"),
      agentSystemBinding("cursor", "available"),
      agentSystemBinding("devin", "unknown"),
    ],
  },
  {
    id: "demo-md-pr-agent",
    kind: "markdown_file",
    label: "pr-author.md",
    agentSystems: agentMd("pr-author.md"),
  },
  {
    id: "demo-mcp-github",
    kind: "mcp_server",
    label: "github",
    agentSystems: [
      agentSystemBinding("claude-code", "available"),
      agentSystemBinding("cursor", "available"),
    ],
  },
  {
    id: "demo-mcp-create-pr",
    kind: "mcp_tool",
    label: "create_pull_request",
    agentSystems: [
      agentSystemBinding("claude-code", "available"),
      agentSystemBinding("cursor", "unavailable"),
    ],
  },
  {
    id: "demo-code-patch",
    kind: "code_file",
    label: "feature.patch",
    agentSystems: [
      agentSystemBinding("claude-code", "available"),
      agentSystemBinding("cursor", "available"),
    ],
  },
];

export const ORCHESTRATOR_DEMO_EDGES: WorkflowLabEdge[] = [
  { id: "demo-edge-skill-orch", source: "demo-skill-orchestrator", target: "demo-orchestrator", kind: "agent-skill" },
  { id: "demo-edge-skill-ba", source: "demo-skill-orchestrator", target: "demo-ba", kind: "agent-skill" },
  { id: "demo-edge-skill-arch", source: "demo-skill-orchestrator", target: "demo-architect", kind: "agent-skill" },
  { id: "demo-edge-skill-impl", source: "demo-skill-orchestrator", target: "demo-implementer", kind: "agent-skill" },
  { id: "demo-edge-skill-review", source: "demo-skill-orchestrator", target: "demo-code-reviewer", kind: "agent-skill" },
  { id: "demo-edge-skill-spec", source: "demo-skill-orchestrator", target: "demo-spec-reviewer", kind: "agent-skill" },
  { id: "demo-edge-skill-pr", source: "demo-skill-orchestrator", target: "demo-pr-agent", kind: "agent-skill" },
  { id: "demo-edge-roadmap", source: "demo-md-roadmap", target: "demo-orchestrator", kind: "agent-markdown-file" },
  { id: "demo-edge-spec", source: "demo-md-spec", target: "demo-orchestrator", kind: "agent-markdown-file" },
  { id: "demo-edge-orch-def", source: "demo-orchestrator", target: "demo-md-orchestrator", kind: "agent-markdown-file" },
  { id: "demo-edge-orch-ba", source: "demo-orchestrator", target: "demo-ba", kind: "agent-agent" },
  { id: "demo-edge-ba-def", source: "demo-ba", target: "demo-md-ba", kind: "agent-markdown-file" },
  { id: "demo-edge-ba-tasks", source: "demo-ba", target: "demo-md-tasks", kind: "agent-markdown-file" },
  { id: "demo-edge-ba-arch", source: "demo-ba", target: "demo-architect", kind: "agent-agent" },
  { id: "demo-edge-arch-def", source: "demo-architect", target: "demo-md-architect", kind: "agent-markdown-file" },
  { id: "demo-edge-arch-handoff", source: "demo-architect", target: "demo-md-handoff", kind: "agent-markdown-file" },
  { id: "demo-edge-arch-impl", source: "demo-architect", target: "demo-implementer", kind: "agent-agent" },
  { id: "demo-edge-impl-def", source: "demo-implementer", target: "demo-md-implementer", kind: "agent-markdown-file" },
  { id: "demo-edge-impl-patch", source: "demo-implementer", target: "demo-code-patch", kind: "agent-code-file" },
  { id: "demo-edge-impl-review", source: "demo-implementer", target: "demo-code-reviewer", kind: "agent-agent" },
  { id: "demo-edge-review-def", source: "demo-code-reviewer", target: "demo-md-code-reviewer", kind: "agent-markdown-file" },
  { id: "demo-edge-review-skill", source: "demo-code-reviewer", target: "demo-skill-review", kind: "agent-skill" },
  { id: "demo-edge-review-spec", source: "demo-code-reviewer", target: "demo-spec-reviewer", kind: "agent-agent" },
  { id: "demo-edge-spec-rev-def", source: "demo-spec-reviewer", target: "demo-md-spec-reviewer", kind: "agent-markdown-file" },
  { id: "demo-edge-spec-md", source: "demo-md-spec", target: "demo-spec-reviewer", kind: "agent-markdown-file" },
  { id: "demo-edge-spec-pr", source: "demo-spec-reviewer", target: "demo-pr-agent", kind: "agent-agent" },
  { id: "demo-edge-pr-def", source: "demo-pr-agent", target: "demo-md-pr-agent", kind: "agent-markdown-file" },
  { id: "demo-edge-pr-github", source: "demo-pr-agent", target: "demo-mcp-github", kind: "agent-mcp-server" },
  { id: "demo-edge-github-tool", source: "demo-mcp-github", target: "demo-mcp-create-pr", kind: "mcp-server-mcp-tool" },
];
