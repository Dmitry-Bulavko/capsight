import type { PlatformId } from "../adapters/platform.js";
import type { ScanResult } from "./scan.js";

export interface ScanStatusSummary {
  projectPath: string;
  platform: PlatformId;
  scannedAt: string;
  version: ScanResult["snapshot"]["version"];
  agents: {
    active: number;
    invalid: number;
    ambiguous: number;
    shadowed: number;
  };
  skillsCount: number;
  instructionsCount: number;
  mcpServersCount: number;
}

export function buildStatusSummary(result: ScanResult): ScanStatusSummary {
  const counts = { active: 0, invalid: 0, ambiguous: 0, shadowed: 0 };

  for (const agent of result.snapshot.agents) {
    if (agent.status in counts) {
      counts[agent.status as keyof typeof counts] += 1;
    }
  }

  return {
    projectPath: result.snapshot.projectPath,
    platform: result.platform,
    scannedAt: result.snapshot.scannedAt,
    version: result.snapshot.version,
    agents: counts,
    skillsCount: result.snapshot.skills.length,
    instructionsCount: result.snapshot.instructions.length,
    mcpServersCount: result.snapshot.mcpServers.length,
  };
}
