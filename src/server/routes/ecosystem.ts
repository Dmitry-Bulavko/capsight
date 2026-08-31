import path from "node:path";
import { Router, type Response } from "express";
import { COMPAT_MATRIX_ENTRIES as CLAUDE_COMPAT } from "../../adapters/claude/version/matrix.js";
import { COMPAT_MATRIX_ENTRIES as CODEX_COMPAT } from "../../adapters/codex/version/matrix.js";
import { COMPAT_MATRIX_ENTRIES as CURSOR_COMPAT } from "../../adapters/cursor/version/matrix.js";
import { PLATFORM_IDS, type PlatformId } from "../../adapters/platform.js";
import {
  buildScannedRoots,
  isMarkdownContentKind,
  readResourceContent,
  ResourceContentError,
} from "../../application/resource-content.js";
import { buildEcosystemHealth, type EcosystemHealthSummary } from "../../application/ecosystem-health.js";
import {
  getEcosystemInventory,
  getPlatformDetection,
  getPlatformScans,
} from "../../application/scan-store.js";
import type { ScanResult } from "../../application/scan.js";
import {
  lookupCompat,
  mergeCompatEntries,
  type CompatVerdict,
} from "../../core/compat/index.js";
import type {
  EcosystemInventory,
  InventoryResource,
  InventoryResourceKind,
  OverlapRelation,
  Warning,
} from "../../core/model/index.js";

const ALL_COMPAT_ENTRIES = mergeCompatEntries(
  CLAUDE_COMPAT,
  CURSOR_COMPAT,
  CODEX_COMPAT,
);

export interface ResourceCompatVerdicts {
  [platform: string]: CompatVerdict;
}

export interface InventoryResourceWithCompat extends InventoryResource {
  compat: ResourceCompatVerdicts;
}

export interface EcosystemApiPayload {
  projectPath: string;
  detection: EcosystemInventory["detection"];
  resources: Record<InventoryResourceKind, InventoryResourceWithCompat[]>;
  overlaps: OverlapRelation[];
  health: EcosystemHealthSummary;
  /** Snapshot-level warnings aggregated across platform scans (§7.7). */
  snapshotWarnings: Warning[];
}

export interface RelatedPathEntry {
  path: string;
  role: string;
}

export interface EcosystemResourceDetail {
  resource: InventoryResourceWithCompat;
  relatedFiles: RelatedPathEntry[];
  relatedFolders: RelatedPathEntry[];
  overlaps: OverlapRelation[];
  snapshot?: unknown;
}

function requireInventory(res: Response): EcosystemInventory | null {
  const inventory = getEcosystemInventory();
  if (!inventory) {
    res.status(404).json({ error: "No scan available" });
    return null;
  }
  return inventory;
}

function platformVersion(scans: Partial<Record<PlatformId, ScanResult>>, platform: string): string {
  const scan = scans[platform as PlatformId];
  return scan?.snapshot.version.version ?? "unknown";
}

export function buildCompatVerdicts(
  resource: InventoryResource,
  scans: Partial<Record<PlatformId, ScanResult>>,
): ResourceCompatVerdicts {
  const compat: ResourceCompatVerdicts = {};
  for (const platform of PLATFORM_IDS) {
    compat[platform] = lookupCompat({
      resourceClass: resource.resourceClass,
      platform,
      version: platformVersion(scans, platform),
      entries: ALL_COMPAT_ENTRIES,
    });
  }
  return compat;
}

function withCompat(
  resource: InventoryResource,
  scans: Partial<Record<PlatformId, ScanResult>>,
): InventoryResourceWithCompat {
  return {
    ...resource,
    compat: buildCompatVerdicts(resource, scans),
  };
}

export function findInventoryResource(
  inventory: EcosystemInventory,
  id: string,
): InventoryResource | undefined {
  for (const kind of Object.keys(inventory.resources) as InventoryResourceKind[]) {
    const found = inventory.resources[kind].find((resource) => resource.id === id);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function localResourceId(resource: InventoryResource): string {
  const prefix = `${resource.platform}:${resource.kind}:`;
  return resource.id.startsWith(prefix) ? resource.id.slice(prefix.length) : resource.id;
}

function findSnapshotEntity(resource: InventoryResource, scan: ScanResult): unknown | undefined {
  const localId = localResourceId(resource);
  const snapshot = scan.snapshot;

  switch (resource.kind) {
    case "agent":
      return snapshot.agents.find((agent) => agent.id === localId);
    case "skill":
      return (snapshot.skills as Array<{ id: string }>).find((skill) => skill.id === localId);
    case "instruction":
      return (snapshot.instructions as Array<{ id: string }>).find(
        (instruction) => instruction.id === localId,
      );
    case "mcp_server":
      return (snapshot.mcpServers as Array<{ id: string }>).find((server) => server.id === localId);
    default:
      return undefined;
  }
}

export function buildRelatedPaths(resource: InventoryResource): {
  relatedFiles: RelatedPathEntry[];
  relatedFolders: RelatedPathEntry[];
} {
  const relatedFiles: RelatedPathEntry[] = [];
  const relatedFolders: RelatedPathEntry[] = [];

  if (!resource.path) {
    return { relatedFiles, relatedFolders };
  }

  if (resource.kind === "mcp_server") {
    relatedFiles.push({ path: resource.path, role: "config-file" });
    relatedFolders.push({ path: path.dirname(resource.path), role: "config-directory" });
    return { relatedFiles, relatedFolders };
  }

  relatedFiles.push({
    path: resource.path,
    role: resource.kind === "instruction" ? "instruction-file" : "primary",
  });

  const parentDir = path.dirname(resource.path);
  relatedFolders.push({
    path: parentDir,
    role:
      resource.kind === "skill" && resource.resourceClass.endsWith("directory")
        ? "skill-directory"
        : "parent-directory",
  });

  if (resource.kind === "skill" && resource.resourceClass.endsWith("directory")) {
    relatedFolders.push({ path: resource.path, role: "skill-root" });
  }

  return { relatedFiles, relatedFolders };
}

function overlapsForResource(inventory: EcosystemInventory, id: string): OverlapRelation[] {
  return inventory.overlaps.filter((relation) => relation.ids.includes(id as never));
}

export function buildEcosystemApiPayload(
  inventory: EcosystemInventory,
  scans: Partial<Record<PlatformId, ScanResult>>,
): EcosystemApiPayload {
  const resources = {} as Record<InventoryResourceKind, InventoryResourceWithCompat[]>;
  for (const kind of Object.keys(inventory.resources) as InventoryResourceKind[]) {
    resources[kind] = inventory.resources[kind].map((resource) => withCompat(resource, scans));
  }

  const snapshotWarnings: Warning[] = [];
  for (const platform of PLATFORM_IDS) {
    const scan = scans[platform];
    if (scan) {
      snapshotWarnings.push(...scan.snapshot.warnings);
    }
  }

  return {
    projectPath: inventory.projectPath,
    detection: inventory.detection,
    resources,
    overlaps: inventory.overlaps,
    health: buildEcosystemHealth({ inventory, scans, resources }),
    snapshotWarnings,
  };
}

export function buildResourceDetail(
  inventory: EcosystemInventory,
  scans: Partial<Record<PlatformId, ScanResult>>,
  id: string,
): EcosystemResourceDetail | undefined {
  const resource = findInventoryResource(inventory, id);
  if (!resource) {
    return undefined;
  }

  const scan = scans[resource.platform as PlatformId];
  const { relatedFiles, relatedFolders } = buildRelatedPaths(resource);

  return {
    resource: withCompat(resource, scans),
    relatedFiles,
    relatedFolders,
    overlaps: overlapsForResource(inventory, id),
    ...(scan ? { snapshot: findSnapshotEntity(resource, scan) } : {}),
  };
}

export const ecosystemRouter = Router();

ecosystemRouter.get("/", (_req, res) => {
  const inventory = requireInventory(res);
  if (!inventory) {
    return;
  }

  res.json(buildEcosystemApiPayload(inventory, getPlatformScans()));
});

ecosystemRouter.get("/resource/:id/content", async (req, res) => {
  const inventory = requireInventory(res);
  if (!inventory) {
    return;
  }

  const resource = findInventoryResource(inventory, req.params.id);
  if (!resource) {
    res.status(404).json({ error: "Resource not found in current inventory" });
    return;
  }

  if (!isMarkdownContentKind(resource.kind)) {
    res.status(415).json({
      error: `Content is not served for ${resource.kind} resources; use the redacted inventory model instead`,
    });
    return;
  }

  const roots = await buildScannedRoots(inventory.projectPath, getPlatformDetection());

  try {
    const content = await readResourceContent(resource, roots);
    res.json(content);
  } catch (error) {
    if (error instanceof ResourceContentError) {
      if (error.code === "refused") {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error.code === "not-file") {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

ecosystemRouter.get("/resource/:id", (req, res) => {
  const inventory = requireInventory(res);
  if (!inventory) {
    return;
  }

  const detail = buildResourceDetail(inventory, getPlatformScans(), req.params.id);
  if (!detail) {
    res.status(404).json({ error: "Resource not found in current inventory" });
    return;
  }

  res.json(detail);
});
