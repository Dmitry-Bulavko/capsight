import type { PlatformVersion } from "../../../core/model/index.js";
import { computeSnapshotId } from "../../shared/snapshot-id.js";
import type { CodexProjectSnapshot as ProjectSnapshot } from "../model/index.js";
import { buildPlatformEnvironment } from "../environment/index.js";
import { discoverAgents } from "./agents.js";
import { discoverInstructions } from "./instructions.js";
import { discoverMcpServers } from "./mcp.js";
import type { WalkProjectScopesResult } from "./project-walk.js";
import { discoverSettingsLayers } from "./settings.js";
import { discoverSkills } from "./skills.js";
import { readTrustState } from "./trust.js";

export interface BuildSnapshotInput {
  projectPath: string;
  version: PlatformVersion;
  walk: WalkProjectScopesResult;
}

export async function buildProjectSnapshot(
  input: BuildSnapshotInput,
): Promise<ProjectSnapshot> {
  const { projectPath, version, walk } = input;

  const trust = await readTrustState(projectPath);

  const versionString = version.version;

  const [instructions, mcpServers, settings, agentResult, skills] = await Promise.all([
    discoverInstructions(walk, versionString),
    discoverMcpServers(walk, trust),
    discoverSettingsLayers(walk, trust, versionString),
    discoverAgents(walk.scopes, projectPath, versionString),
    discoverSkills(walk.scopes, projectPath),
  ]);

  const environment = await buildPlatformEnvironment({ settingsLayers: settings });
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
    warnings: [],
    scannedAt,
  };
}
