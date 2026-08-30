import {

  DEFAULT_PLATFORM_ID,

  PLATFORM_IDS,

  type PlatformId,

} from "../adapters/platform.js";

import type { Agent, PlatformDetection, EcosystemInventory } from "../core/model/index.js";

import { detectPlatforms } from "./detect-platforms.js";

import { buildEcosystemInventory } from "./ecosystem.js";

import { scan, type ScanResult } from "./scan.js";



interface StoredScanState {

  projectPath: string;

  detection: PlatformDetection[];

  scans: Partial<Record<PlatformId, ScanResult>>;

  activePlatform: PlatformId;

}



let storedState: StoredScanState | null = null;



function ensureState(): StoredScanState {

  if (!storedState) {

    storedState = {

      projectPath: "",

      detection: PLATFORM_IDS.map((platform) => ({

        platform,

        status: "not-detected",

        evidence: [],

      })),

      scans: {},

      activePlatform: DEFAULT_PLATFORM_ID,

    };

  }

  return storedState;

}



export function setLastScan(result: ScanResult): void {

  const state = ensureState();

  state.projectPath = result.snapshot.projectPath;

  state.scans[result.platform] = result;

  state.activePlatform = result.platform;

}



export function getLastScan(): ScanResult | null {

  if (!storedState) {

    return null;

  }

  return storedState.scans[storedState.activePlatform] ?? null;

}



export function getPlatformScan(platform: PlatformId): ScanResult | undefined {

  return storedState?.scans[platform];

}



export function getPlatformScans(): Partial<Record<PlatformId, ScanResult>> {

  return storedState?.scans ?? {};

}



export function getPlatformDetection(): PlatformDetection[] {

  return storedState?.detection ?? [];

}



export function getEcosystemInventory(): EcosystemInventory | null {

  if (!storedState) {

    return null;

  }



  return buildEcosystemInventory({

    projectPath: storedState.projectPath,

    detection: storedState.detection,

    scans: storedState.scans,

  });

}



export function clearLastScan(): void {

  storedState = null;

}



/** Single-platform consumers: requested platform, else default Claude (main behavior). */
function resolveActivePlatform(requested?: PlatformId): PlatformId {
  return requested ?? DEFAULT_PLATFORM_ID;
}



export async function scanAndStore(

  projectPath: string,

  platform?: PlatformId,

): Promise<ScanResult> {

  const detection = await detectPlatforms(projectPath);

  const scans: Partial<Record<PlatformId, ScanResult>> = {};



  for (const entry of detection) {
    if (entry.status !== "detected") {
      continue;
    }
    const platformId = entry.platform as PlatformId;
    scans[platformId] = await scan({ projectPath, platform: platformId });
  }

  const activePlatform = resolveActivePlatform(platform);

  // Preserve main single-platform behavior: always scan the active platform even
  // when detection found no evidence (empty project, explicit platform request).
  if (!scans[activePlatform]) {
    scans[activePlatform] = await scan({ projectPath, platform: activePlatform });
  }

  storedState = {
    projectPath,
    detection,
    scans,
    activePlatform,
  };

  return scans[activePlatform]!;

}



export async function getOrScan(projectPath: string = process.cwd()): Promise<ScanResult> {

  const active = getLastScan();

  if (active) {

    return active;

  }

  return scanAndStore(projectPath);

}



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



export function getAgentsFromResult(result: ScanResult): Agent[] {

  return result.snapshot.agents;

}


