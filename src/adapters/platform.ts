/**
 * Platform adapter types and helpers.
 * @see docs/SPEC.md §12.2
 */

import type {
  EffectiveConfiguration,
  ExecutionContext,
  ProjectSnapshot,
} from "../core/model/index.js";

export const PLATFORM_IDS = ["claude", "cursor", "codex"] as const;
export type PlatformId = (typeof PLATFORM_IDS)[number];
export const DEFAULT_PLATFORM_ID: PlatformId = "claude";

export interface AdapterScanOptions {
  projectPath: string;
  addDirs?: string[];
  pluginRoots?: string[];
}

export interface AdapterScanResult {
  snapshot: ProjectSnapshot;
  status: "complete";
}

export interface PlatformAdapter {
  readonly id: PlatformId;
  scan(options: AdapterScanOptions): Promise<AdapterScanResult>;
  resolve(
    snapshot: ProjectSnapshot,
    agentId: string,
    context: ExecutionContext,
  ): Promise<EffectiveConfiguration>;
}

export class PlatformNotImplementedError extends Error {
  constructor(platform: PlatformId) {
    super(`Platform "${platform}" is not implemented yet`);
    this.name = "PlatformNotImplementedError";
  }
}

export class UnknownPlatformError extends Error {
  constructor(value: string) {
    super(`Unknown platform: ${value}. Expected one of: ${PLATFORM_IDS.join(", ")}`);
    this.name = "UnknownPlatformError";
  }
}

export function isPlatformId(value: string): value is PlatformId {
  return (PLATFORM_IDS as readonly string[]).includes(value);
}

export function parsePlatformId(value: unknown): PlatformId | undefined {
  if (typeof value === "string" && isPlatformId(value)) {
    return value;
  }
  return undefined;
}
