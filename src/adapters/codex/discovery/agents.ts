import path from "node:path";
import type { Scope, SourceInfo } from "../../../core/model/index.js";
import type { CodexAgent as Agent } from "../model/index.js";
import { CODEX_PLATFORM } from "../model/index.js";
import type { DiscoveredInstruction } from "./types.js";
import type { ProjectScopeLevel } from "./project-walk.js";

export interface AgentDiscoveryResult {
  agents: Agent[];
  invalidCount: number;
}

function agentId(filePath: string): string {
  return `codex-main:${filePath}`;
}

function sourceInfo(scope: Scope, filePath: string): SourceInfo {
  return { platform: CODEX_PLATFORM, scope, path: filePath };
}

/**
 * Codex v1: instruction-based primary agent (XA1). Emit one synthetic "main"
 * agent when project AGENTS.md exists so resolveEffective has a subject.
 * @see docs/CODEX-FACTS.md XA1, XA3
 */
export async function discoverAgents(
  projectScopes: ProjectScopeLevel[],
  projectPath: string,
): Promise<AgentDiscoveryResult> {
  const resolvedProject = path.resolve(projectPath);

  for (const scope of projectScopes) {
    if (path.resolve(scope.path) !== resolvedProject) {
      continue;
    }
    if (!scope.agentsMdPath) {
      continue;
    }

    const agent: Agent = {
      id: agentId(scope.agentsMdPath),
      name: "main",
      description: "Primary Codex agent (AGENTS.md instruction chain)",
      source: sourceInfo("project", scope.agentsMdPath),
      status: "active",
      configuration: { unknownFields: {} },
      isPluginAgent: false,
    };
    return { agents: [agent], invalidCount: 0 };
  }

  return { agents: [], invalidCount: 0 };
}

export function findMainAgent(
  agents: readonly Agent[],
  _instructions: readonly DiscoveredInstruction[],
): Agent | undefined {
  return agents.find((entry) => entry.name === "main" && entry.status === "active");
}
