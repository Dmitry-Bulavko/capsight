import fs from "node:fs/promises";
import path from "node:path";
import type { Scope, SourceInfo } from "../../../core/model/index.js";
import type { CodexAgent as Agent } from "../model/index.js";
import { CODEX_PLATFORM } from "../model/index.js";
import { gateCapability, MATRIX } from "../version/matrix.js";
import { loadFallbackFilenames } from "./instructions.js";
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

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveProjectInstructionPath(
  scope: ProjectScopeLevel,
  fallbackNames: string[],
): Promise<string | undefined> {
  if (scope.agentsOverridePath && (await pathExists(scope.agentsOverridePath))) {
    return scope.agentsOverridePath;
  }
  if (scope.agentsMdPath && (await pathExists(scope.agentsMdPath))) {
    return scope.agentsMdPath;
  }
  for (const fallbackName of fallbackNames) {
    const fallbackPath = path.join(scope.path, fallbackName);
    if (await pathExists(fallbackPath)) {
      return fallbackPath;
    }
  }
  return undefined;
}

/**
 * Codex v1: instruction-based primary agent (XA1). Emit one synthetic "main"
 * agent when project instructions exist so resolveEffective has a subject.
 * @see docs/CODEX-FACTS.md XA1, XA3
 */
export async function discoverAgents(
  projectScopes: ProjectScopeLevel[],
  projectPath: string,
  version: string,
): Promise<AgentDiscoveryResult> {
  const instructionAgentGate = gateCapability(MATRIX["agent.instructionBased"], version);
  const fallbackGate = gateCapability(MATRIX["instruction.fallback"], version);
  const resolvedProject = path.resolve(projectPath);
  const fallbackNames = fallbackGate.unfounded ? [] : await loadFallbackFilenames();

  for (const scope of projectScopes) {
    if (path.resolve(scope.path) !== resolvedProject) {
      continue;
    }

    let instructionPath: string | undefined;
    if (scope.agentsMdPath && (await pathExists(scope.agentsMdPath))) {
      instructionPath = scope.agentsMdPath;
    } else {
      instructionPath = await resolveProjectInstructionPath(scope, fallbackNames);
    }
    if (!instructionPath) {
      continue;
    }

    const agent: Agent = {
      id: agentId(instructionPath),
      name: "main",
      description: "Primary Codex agent (AGENTS.md instruction chain)",
      source: sourceInfo("project", instructionPath),
      status: instructionAgentGate.unfounded ? "unknown" : "active",
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
