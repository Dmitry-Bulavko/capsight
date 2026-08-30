/**
 * Declared ecosystem inventory types (SPEC §7.4 declared half).
 * @see docs/tasks/EC-02-multi-platform-scan.md
 */

import type { ResourceClass } from "../compat/resource-class.js";
import type { Enforcement, Scope, SourceInfo } from "./index.js";

export type InventoryResourceKind = "agent" | "skill" | "mcp_server" | "instruction";

export function isMarkdownContentKind(kind: InventoryResourceKind): boolean {
  return kind === "agent" || kind === "skill" || kind === "instruction";
}

export type PlatformDetectionStatus = "detected" | "not-detected";

export interface PlatformDetection {
  platform: string;
  status: PlatformDetectionStatus;
  evidence: SourceInfo[];
}

export interface InventoryResource {
  id: string;
  kind: InventoryResourceKind;
  platform: string;
  scope: Scope;
  resourceClass: ResourceClass;
  path?: string;
  name?: string;
}

export interface OverlapCollision {
  candidates: SourceInfo[];
  /**
   * The candidate that loads. Absent when the collision rule does not name a
   * winner (A4) or the matrix does not found the winner rule.
   */
  effective?: SourceInfo;
  rule: string;
  matrixRef?: string;
  enforcement?: Enforcement;
}

export interface OverlapRelation {
  /** Stable pair of inventory resource ids (sorted lexicographically). */
  ids: [string, string];
  collision: OverlapCollision;
}

export interface EcosystemInventory {
  projectPath: string;
  detection: PlatformDetection[];
  resources: Record<InventoryResourceKind, InventoryResource[]>;
  overlaps: OverlapRelation[];
}
