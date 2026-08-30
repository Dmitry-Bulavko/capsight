/**
 * Ecosystem health readout — counts and conditions, no score.
 * @see docs/tasks/EC-07-health-readout.md
 */

import { PLATFORM_IDS, type PlatformId } from "../adapters/platform.js";
import type { CompatVerdict } from "../core/compat/index.js";
import type {
  EcosystemInventory,
  InventoryResource,
  InventoryResourceKind,
  OverlapRelation,
  Warning,
} from "../core/model/index.js";
import type { InventoryResourceWithCompat } from "../server/routes/ecosystem.js";
import type { ScanStatusSummary } from "./scan-status-summary.js";
import { buildStatusSummary } from "./scan-status-summary.js";
import type { ScanResult } from "./scan.js";

export type HealthFilterId = string;

export interface HealthCountLink {
  id: HealthFilterId;
  label: string;
  count: number;
  resourceIds: string[];
}

export interface AgentStatusHealth {
  active: HealthCountLink;
  invalid: HealthCountLink;
  ambiguous: HealthCountLink;
  shadowed: HealthCountLink;
}

export interface PlatformHealthSection {
  platform: PlatformId;
  detected: boolean;
  statusSummary?: ScanStatusSummary;
  agents: AgentStatusHealth;
  skills: HealthCountLink;
  instructions: HealthCountLink;
  mcpNotSupported: HealthCountLink;
  mcpUnknown: HealthCountLink;
}

export interface WarningSeverityHealth {
  info: HealthCountLink;
  warning: HealthCountLink;
  critical: HealthCountLink;
}

export interface EcosystemHealthSummary {
  platforms: PlatformHealthSection[];
  localOverrides: HealthCountLink;
  unresolvedCollisions: HealthCountLink;
  compatUnknown: HealthCountLink;
  warnings: WarningSeverityHealth;
}

export interface BuildEcosystemHealthInput {
  inventory: EcosystemInventory;
  scans: Partial<Record<PlatformId, ScanResult>>;
  resources: Record<InventoryResourceKind, InventoryResourceWithCompat[]>;
}

const INVENTORY_KINDS: InventoryResourceKind[] = ["agent", "skill", "mcp_server", "instruction"];

const AGENT_STATUSES = ["active", "invalid", "ambiguous", "shadowed"] as const;
type AgentStatus = (typeof AGENT_STATUSES)[number];

const WARNING_SEVERITIES = ["info", "warning", "critical"] as const;
type WarningSeverity = (typeof WARNING_SEVERITIES)[number];

function healthLink(
  id: HealthFilterId,
  label: string,
  resourceIds: string[],
): HealthCountLink {
  return {
    id,
    label,
    count: resourceIds.length,
    resourceIds,
  };
}

function localResourceId(resource: InventoryResource): string {
  const prefix = `${resource.platform}:${resource.kind}:`;
  return resource.id.startsWith(prefix) ? resource.id.slice(prefix.length) : resource.id;
}

function normalizePathKey(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value.replace(/\\/g, "/");
}

function allInventoryResources(
  inventory: EcosystemInventory,
): InventoryResource[] {
  const items: InventoryResource[] = [];
  for (const kind of INVENTORY_KINDS) {
    items.push(...inventory.resources[kind]);
  }
  return items;
}


function agentStatusByLocalId(scan: ScanResult): Map<string, string> {
  return new Map(scan.snapshot.agents.map((agent) => [agent.id, agent.status]));
}

function agentStatusResourceIds(
  platform: PlatformId,
  status: AgentStatus,
  inventory: EcosystemInventory,
  scans: Partial<Record<PlatformId, ScanResult>>,
): string[] {
  const scan = scans[platform];
  if (!scan) {
    return [];
  }

  const statuses = agentStatusByLocalId(scan);
  return inventory.resources.agent
    .filter((resource) => {
      if (resource.platform !== platform) {
        return false;
      }
      return statuses.get(localResourceId(resource)) === status;
    })
    .map((resource) => resource.id);
}

function buildAgentStatusHealth(
  platform: PlatformId,
  inventory: EcosystemInventory,
  scans: Partial<Record<PlatformId, ScanResult>>,
): AgentStatusHealth {
  const labels: Record<AgentStatus, string> = {
    active: "active",
    invalid: "invalid",
    ambiguous: "ambiguous",
    shadowed: "shadowed",
  };

  const entries = {} as AgentStatusHealth;
  for (const status of AGENT_STATUSES) {
    entries[status] = healthLink(
      `agents:${platform}:${status}`,
      labels[status],
      agentStatusResourceIds(platform, status, inventory, scans),
    );
  }
  return entries;
}

function kindResourceIds(
  platform: PlatformId,
  kind: InventoryResourceKind,
  inventory: EcosystemInventory,
): string[] {
  return inventory.resources[kind]
    .filter((resource) => resource.platform === platform)
    .map((resource) => resource.id);
}

function hasCompatSupport(
  compat: Record<string, CompatVerdict>,
  support: CompatVerdict["support"],
): boolean {
  return Object.values(compat).some((verdict) => verdict.support === support);
}

function mcpCompatResourceIds(
  platform: PlatformId,
  support: "not-supported" | "unknown",
  resources: Record<InventoryResourceKind, InventoryResourceWithCompat[]>,
): string[] {
  return resources.mcp_server
    .filter((resource) => resource.platform === platform && hasCompatSupport(resource.compat, support))
    .map((resource) => resource.id);
}

function localOverrideResourceIds(inventory: EcosystemInventory): string[] {
  return allInventoryResources(inventory)
    .filter((resource) => resource.scope === "local")
    .map((resource) => resource.id);
}

function isOverlapUnresolved(overlap: OverlapRelation): boolean {
  return overlap.collision.effective === undefined;
}

function unresolvedCollisionResourceIds(overlaps: OverlapRelation[]): string[] {
  const ids = new Set<string>();
  for (const overlap of overlaps) {
    if (isOverlapUnresolved(overlap)) {
      ids.add(overlap.ids[0]);
      ids.add(overlap.ids[1]);
    }
  }
  return [...ids];
}

function compatUnknownResourceIds(
  resources: Record<InventoryResourceKind, InventoryResourceWithCompat[]>,
): string[] {
  const ids: string[] = [];
  for (const kind of INVENTORY_KINDS) {
    for (const resource of resources[kind] ?? []) {
      if (hasCompatSupport(resource.compat, "unknown")) {
        ids.push(resource.id);
      }
    }
  }
  return ids;
}

function resourcesForWarning(
  warning: Warning,
  inventory: EcosystemInventory,
): string[] {
  const evidencePaths = new Set(
    warning.evidence
      .map((source) => normalizePathKey(source.path))
      .filter((value): value is string => Boolean(value)),
  );

  if (evidencePaths.size === 0) {
    return [];
  }

  const ids: string[] = [];
  for (const resource of allInventoryResources(inventory)) {
    const path = normalizePathKey(resource.path);
    if (path && evidencePaths.has(path)) {
      ids.push(resource.id);
    }
  }
  return ids;
}

function buildWarningSeverityHealth(
  inventory: EcosystemInventory,
  scans: Partial<Record<PlatformId, ScanResult>>,
): WarningSeverityHealth {
  const idsBySeverity: Record<WarningSeverity, Set<string>> = {
    info: new Set(),
    warning: new Set(),
    critical: new Set(),
  };

  for (const scan of Object.values(scans)) {
    if (!scan) {
      continue;
    }
    for (const warning of scan.snapshot.warnings) {
      if (!WARNING_SEVERITIES.includes(warning.severity as WarningSeverity)) {
        continue;
      }
      const severity = warning.severity as WarningSeverity;
      for (const id of resourcesForWarning(warning, inventory)) {
        idsBySeverity[severity].add(id);
      }
    }
  }

  const labels: Record<WarningSeverity, string> = {
    info: "info",
    warning: "warning",
    critical: "critical",
  };

  const result = {} as WarningSeverityHealth;
  for (const severity of WARNING_SEVERITIES) {
    const resourceIds = [...idsBySeverity[severity]];
    result[severity] = healthLink(`warnings:${severity}`, labels[severity], resourceIds);
  }
  return result;
}

function warningCountsBySeverity(
  scans: Partial<Record<PlatformId, ScanResult>>,
): Record<WarningSeverity, number> {
  const counts: Record<WarningSeverity, number> = {
    info: 0,
    warning: 0,
    critical: 0,
  };

  for (const scan of Object.values(scans)) {
    if (!scan) {
      continue;
    }
    for (const warning of scan.snapshot.warnings) {
      if (WARNING_SEVERITIES.includes(warning.severity as WarningSeverity)) {
        counts[warning.severity as WarningSeverity] += 1;
      }
    }
  }
  return counts;
}

export function buildEcosystemHealth(input: BuildEcosystemHealthInput): EcosystemHealthSummary {
  const { inventory, scans, resources } = input;
  const detectedPlatforms = new Set(
    inventory.detection
      .filter((entry) => entry.status === "detected")
      .map((entry) => entry.platform),
  );

  const platforms = PLATFORM_IDS.map((platform) => {
    const scan = scans[platform];
    const detected = detectedPlatforms.has(platform);
    return {
      platform,
      detected,
      ...(scan ? { statusSummary: buildStatusSummary(scan) } : {}),
      agents: buildAgentStatusHealth(platform, inventory, scans),
      skills: healthLink(
        `skills:${platform}`,
        "skills",
        kindResourceIds(platform, "skill", inventory),
      ),
      instructions: healthLink(
        `instructions:${platform}`,
        "instructions",
        kindResourceIds(platform, "instruction", inventory),
      ),
      mcpNotSupported: healthLink(
        `mcp:${platform}:not-supported`,
        "MCP not-supported",
        mcpCompatResourceIds(platform, "not-supported", resources),
      ),
      mcpUnknown: healthLink(
        `mcp:${platform}:unknown`,
        "MCP unknown",
        mcpCompatResourceIds(platform, "unknown", resources),
      ),
    } satisfies PlatformHealthSection;
  });

  const warnings = buildWarningSeverityHealth(inventory, scans);
  const snapshotWarningCounts = warningCountsBySeverity(scans);
  for (const severity of WARNING_SEVERITIES) {
    warnings[severity].count = snapshotWarningCounts[severity];
  }

  return {
    platforms,
    localOverrides: healthLink(
      "local-overrides",
      "local overrides",
      localOverrideResourceIds(inventory),
    ),
    unresolvedCollisions: healthLink(
      "unresolved-collisions",
      "unresolved collisions",
      unresolvedCollisionResourceIds(inventory.overlaps),
    ),
    compatUnknown: healthLink(
      "compat-unknown",
      "unknown compat",
      compatUnknownResourceIds(resources),
    ),
    warnings,
  };
}
