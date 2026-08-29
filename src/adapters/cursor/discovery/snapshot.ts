import { createHash } from "node:crypto";
import type { PlatformVersion } from "../../../core/model/index.js";
import type { CursorProjectSnapshot as ProjectSnapshot } from "../model/index.js";
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

function computeSnapshotId(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

export async function buildProjectSnapshot(
  input: BuildSnapshotInput,
): Promise<ProjectSnapshot> {
  const { projectPath, version, walk } = input;

  const [agentResult, skills, instructions, mcpServers, settings, trust] =
    await Promise.all([
      discoverAgents(walk.scopes, projectPath),
      discoverSkills(walk.scopes, projectPath),
      discoverInstructions(walk.scopes, projectPath, walk.repoRoot),
      discoverMcpServers(walk.scopes, projectPath),
      discoverSettingsLayers(),
      readTrustState(projectPath),
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
