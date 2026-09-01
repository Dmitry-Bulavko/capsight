import path from "node:path";
import type { PlatformVersion } from "../../../core/model/index.js";
import { computeSnapshotId } from "../../shared/snapshot-id.js";
import type { CursorProjectSnapshot as ProjectSnapshot } from "../model/index.js";
import { buildPlatformEnvironment } from "../environment/index.js";
import { discoverAgents } from "./agents.js";
import { discoverIgnoredRuleFiles, discoverInstructions } from "./instructions.js";
import { discoverMcpServers } from "./mcp.js";
import type { WalkProjectScopesResult } from "./project-walk.js";
import { discoverSettingsLayers } from "./settings.js";
import { discoverSkills } from "./skills.js";
import { readTrustState } from "./trust.js";
import { CURSOR_PLATFORM } from "../model/index.js";
import { FACT } from "../version/facts.js";
import { gateWarning, MATRIX } from "../version/matrix.js";

export interface BuildSnapshotInput {
  projectPath: string;
  version: PlatformVersion;
  walk: WalkProjectScopesResult;
}

export async function buildProjectSnapshot(
  input: BuildSnapshotInput,
): Promise<ProjectSnapshot> {
  const { projectPath, version, walk } = input;

  const [agentResult, skills, instructions, mcpServers, settings, trust, ignoredRules] =
    await Promise.all([
      discoverAgents(walk.scopes, projectPath, version.version),
      discoverSkills(walk.scopes, projectPath),
      discoverInstructions(walk.scopes, projectPath),
      discoverMcpServers(walk.scopes, projectPath),
      discoverSettingsLayers(),
      readTrustState(projectPath),
      discoverIgnoredRuleFiles(walk.scopes, projectPath),
    ]);

  const warnings = ignoredRules.map((entry) =>
    gateWarning(
      {
        category: "unsupported",
        severity: "warning",
        message:
          `Plain .md file "${path.basename(entry.path)}" in .cursor/rules/ is ignored by Cursor; use .mdc extension (${FACT.CR4}).`,
        evidence: [
          {
            platform: CURSOR_PLATFORM,
            scope: entry.scope,
            path: entry.path,
          },
        ],
        enforcement: "enforced",
      },
      MATRIX["rules.fileExtension"],
      version.version,
    ),
  );

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
    warnings,
    scannedAt,
  };
}
