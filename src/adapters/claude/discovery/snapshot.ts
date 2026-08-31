import { createHash } from "node:crypto";
import type { PlatformVersion } from "../../../core/model/index.js";
import type { ClaudeProjectSnapshot as ProjectSnapshot } from "../model/index.js";
import { buildPlatformEnvironment } from "../environment/index.js";
import { discoverAgents } from "./agents.js";
import { discoverInstructions } from "./instructions.js";
import { discoverMcpServers } from "./mcp.js";
import type { WalkProjectScopesResult } from "./project-walk.js";
import { discoverSettingsLayers } from "./settings.js";
import { discoverSkills } from "./skills.js";
import { readTrustState, buildTrustState, agentTrustFolder } from "./trust.js";
import { computeDescriptionBudget } from "./description-budget.js";

export interface BuildSnapshotInput {
  projectPath: string;
  version: PlatformVersion;
  walk: WalkProjectScopesResult;
  addDirs?: string[];
  /** Configured plugin roots; see `discovery/plugins.ts` for why they are input. */
  pluginRoots?: string[];
}

function computeSnapshotId(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

export async function buildProjectSnapshot(
  input: BuildSnapshotInput,
): Promise<ProjectSnapshot> {
  const { projectPath, version, walk, addDirs = [], pluginRoots = [] } = input;

  const [agentResult, skills, instructions, mcpServers, settings] =
    await Promise.all([
      discoverAgents(
        walk.scopes,
        projectPath,
        addDirs,
        version.version,
        pluginRoots,
      ),
      discoverSkills(walk.scopes, projectPath, addDirs, version.version),
      discoverInstructions(walk.scopes, projectPath),
      discoverMcpServers(walk.scopes, projectPath, walk.repoRoot),
      discoverSettingsLayers(walk.scopes),
    ]);

  const folderPaths = new Set<string>();
  for (const agent of agentResult.agents) {
    const folder = agentTrustFolder(agent.source.path ?? "");
    if (folder !== ".") {
      folderPaths.add(folder);
    }
  }

  const trust = await buildTrustState({
    projectPath,
    repoRoot: walk.repoRoot,
    folderPaths: [...folderPaths],
    addDirs,
  });

  const environment = await buildPlatformEnvironment({ settingsLayers: settings });
  const budget = computeDescriptionBudget(agentResult.agents, version.version);
  const scannedAt = new Date().toISOString();

  const snapshotBody = JSON.stringify({
    projectPath: walk.projectPath,
    version,
    environment,
    agents: agentResult.agents,
    skills,
    instructions,
    mcpServers,
    settings,
    trust,
    scannedAt,
  });

  return {
    id: computeSnapshotId(snapshotBody),
    projectPath: walk.projectPath,
    version,
    environment,
    trust,
    agents: agentResult.agents,
    skills,
    instructions,
    mcpServers,
    settings,
    warnings: budget.warnings,
    scannedAt,
  };
}
