import type { Agent, PlatformVersion } from "../core/model/index.js";
import { scan, type ScanResult } from "./scan.js";

let lastScan: ScanResult | null = null;

export function setLastScan(result: ScanResult): void {
  lastScan = result;
}

export function getLastScan(): ScanResult | null {
  return lastScan;
}

export function clearLastScan(): void {
  lastScan = null;
}

export async function scanAndStore(projectPath: string): Promise<ScanResult> {
  const result = await scan({ projectPath });
  setLastScan(result);
  return result;
}

export async function getOrScan(projectPath: string = process.cwd()): Promise<ScanResult> {
  if (lastScan) {
    return lastScan;
  }
  return scanAndStore(projectPath);
}

export interface ScanStatusSummary {
  projectPath: string;
  scannedAt: string;
  version: PlatformVersion;
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
    scannedAt: result.snapshot.scannedAt,
    version: result.snapshot.version,
    agents: counts,
    skillsCount: result.snapshot.skills.length,
    instructionsCount: result.snapshot.instructions.length,
    mcpServersCount: result.snapshot.mcpServers.length,
  };
}

export function getAgentsFromResult(result: ScanResult): Agent[] {
  return result.snapshot.agents;
}
