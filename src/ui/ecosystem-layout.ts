import { Position, type Edge, type Node } from "@xyflow/react";
import type { PlatformId } from "../adapters/platform.js";
import type { InventoryResourceKind, OverlapRelation } from "../core/model/ecosystem.js";
import type { Scope } from "../core/model/index.js";
import type {
  InventoryResourceWithCompat,
  ResourceCompatVerdicts,
} from "../server/routes/ecosystem.js";

export type EcosystemFilterPlatform = PlatformId | "all";
export const ECOSYSTEM_FILTER_ALL = "all" as const;

export const ECOSYSTEM_BLOCK_ORDER = [
  "agent",
  "skill",
  "mcp_server",
  "instruction",
] as const satisfies readonly InventoryResourceKind[];

export type EcosystemBlockKind = (typeof ECOSYSTEM_BLOCK_ORDER)[number];

export const ECOSYSTEM_BLOCK_LABELS: Record<EcosystemBlockKind, string> = {
  agent: "Agents",
  skill: "Skills",
  mcp_server: "MCP",
  instruction: "Rules & instructions",
};

export const ECOSYSTEM_BLOCK_COLORS: Record<EcosystemBlockKind, string> = {
  agent: "#8ab4f8",
  skill: "#c58af9",
  mcp_server: "#f28b82",
  instruction: "#78d9ec",
};

const RESOURCE_NODE_WIDTH = 172;
const RESOURCE_NODE_HEIGHT = 150;
const PAIR_GAP = 8;
const GRID_GAP_X = 14;
const GRID_GAP_Y = 14;
const BLOCK_PADDING = 20;
const BLOCK_HEADER = 36;
const BLOCK_GAP_X = 56;

export interface EcosystemLayoutInput {
  resources: Record<InventoryResourceKind, InventoryResourceWithCompat[]>;
  overlaps: OverlapRelation[];
  filterPlatform?: EcosystemFilterPlatform;
  /** When set, only these resource ids remain undimmed (health readout filter). */
  filterResourceIds?: readonly string[] | null;
}

export interface EcosystemResourceNodeData {
  label: string;
  platform: string;
  scope: Scope;
  kind: InventoryResourceKind;
  blockKind: EcosystemBlockKind;
  compat: ResourceCompatVerdicts;
  dimmed: boolean;
}

export interface EcosystemLayoutResult {
  nodes: Node[];
  edges: Edge[];
  dimmedCount: number;
}

export interface EcosystemBlockNodeData {
  label: string;
  blockKind: EcosystemBlockKind;
  count: number;
  empty: boolean;
}

type LayoutUnit =
  | {
      type: "pair";
      resources: [InventoryResourceWithCompat, InventoryResourceWithCompat];
      overlap: OverlapRelation;
    }
  | { type: "single"; resource: InventoryResourceWithCompat };

function displayName(resource: InventoryResourceWithCompat): string {
  return resource.name?.trim() || resource.id.split(":").pop() || resource.id;
}

function gridColumns(unitCount: number): number {
  if (unitCount <= 1) return 1;
  if (unitCount <= 4) return 2;
  if (unitCount <= 9) return 3;
  return 4;
}

function unitWidth(unit: LayoutUnit): number {
  if (unit.type === "pair") {
    return RESOURCE_NODE_WIDTH * 2 + PAIR_GAP;
  }
  return RESOURCE_NODE_WIDTH;
}

function unitHeight(): number {
  return RESOURCE_NODE_HEIGHT;
}

function blockContentSize(units: LayoutUnit[]): { width: number; height: number; columns: number } {
  if (units.length === 0) {
    return { width: 220, height: 48, columns: 1 };
  }

  const columns = gridColumns(units.length);
  const rows = Math.ceil(units.length / columns);
  let maxRowWidth = 0;

  for (let row = 0; row < rows; row += 1) {
    const rowUnits = units.slice(row * columns, (row + 1) * columns);
    const rowWidth =
      rowUnits.reduce((sum, unit) => sum + unitWidth(unit), 0) +
      Math.max(0, rowUnits.length - 1) * GRID_GAP_X;
    maxRowWidth = Math.max(maxRowWidth, rowWidth);
  }

  return {
    columns,
    width: maxRowWidth,
    height: rows * unitHeight() + Math.max(0, rows - 1) * GRID_GAP_Y,
  };
}

function buildLayoutUnits(
  resources: InventoryResourceWithCompat[],
  overlaps: OverlapRelation[],
): LayoutUnit[] {
  const resourceIds = new Set(resources.map((resource) => resource.id));
  const resourcesById = new Map(resources.map((resource) => [resource.id, resource]));
  const paired = new Set<string>();
  const units: LayoutUnit[] = [];

  for (const overlap of overlaps) {
    const [idA, idB] = overlap.ids;
    if (!resourceIds.has(idA) || !resourceIds.has(idB)) {
      continue;
    }
    if (paired.has(idA) || paired.has(idB)) {
      continue;
    }

    const left = resourcesById.get(idA)!;
    const right = resourcesById.get(idB)!;
    const local = left.scope === "local" ? left : right.scope === "local" ? right : left;
    const other = local.id === left.id ? right : left;

    units.push({
      type: "pair",
      resources: [local, other],
      overlap,
    });
    paired.add(idA);
    paired.add(idB);
  }

  const singles = resources
    .filter((resource) => !paired.has(resource.id))
    .sort((a, b) => displayName(a).localeCompare(displayName(b)))
    .map(
      (resource): LayoutUnit => ({
        type: "single",
        resource,
      }),
    );

  units.push(...singles);
  units.sort((a, b) => {
    const nameA =
      a.type === "pair" ? displayName(a.resources[0]) : displayName(a.resource);
    const nameB =
      b.type === "pair" ? displayName(b.resources[0]) : displayName(b.resource);
    return nameA.localeCompare(nameB);
  });

  return units;
}

function overlapEdgeStyle(resolved: boolean): Edge["style"] {
  return resolved
    ? { stroke: "#81c995", strokeWidth: 1.75 }
    : { stroke: "#fdd663", strokeWidth: 2, strokeDasharray: "6 4" };
}

function resourceNodeStyle(blockKind: EcosystemBlockKind, dimmed: boolean): Node["style"] {
  return {
    borderColor: ECOSYSTEM_BLOCK_COLORS[blockKind],
    background: "#1a1d24",
    color: "#e8eaed",
    width: RESOURCE_NODE_WIDTH,
    height: RESOURCE_NODE_HEIGHT,
    fontSize: 12,
    opacity: dimmed ? 0.38 : 1,
  };
}

export function isResourceDimmed(
  compat: ResourceCompatVerdicts,
  filterPlatform: EcosystemFilterPlatform,
  resourceId: string,
  filterResourceIds?: readonly string[] | null,
): boolean {
  if (filterResourceIds) {
    return !filterResourceIds.includes(resourceId);
  }
  if (filterPlatform === ECOSYSTEM_FILTER_ALL) {
    return false;
  }
  const verdict = compat[filterPlatform];
  return verdict?.support === "not-supported";
}

export function countDimmedResources(
  resources: Record<InventoryResourceKind, InventoryResourceWithCompat[]>,
  filterPlatform: EcosystemFilterPlatform,
  filterResourceIds?: readonly string[] | null,
): number {
  if (filterResourceIds) {
    let count = 0;
    for (const kind of ECOSYSTEM_BLOCK_ORDER) {
      for (const resource of resources[kind] ?? []) {
        if (isResourceDimmed(resource.compat, filterPlatform, resource.id, filterResourceIds)) {
          count += 1;
        }
      }
    }
    return count;
  }

  if (filterPlatform === ECOSYSTEM_FILTER_ALL) {
    return 0;
  }

  let count = 0;
  for (const kind of ECOSYSTEM_BLOCK_ORDER) {
    for (const resource of resources[kind] ?? []) {
      if (isResourceDimmed(resource.compat, filterPlatform, resource.id)) {
        count += 1;
      }
    }
  }
  return count;
}

function resourceNodeData(
  resource: InventoryResourceWithCompat,
  blockKind: EcosystemBlockKind,
  filterPlatform: EcosystemFilterPlatform,
  filterResourceIds?: readonly string[] | null,
): EcosystemResourceNodeData {
  const dimmed = isResourceDimmed(
    resource.compat,
    filterPlatform,
    resource.id,
    filterResourceIds,
  );
  return {
    label: displayName(resource),
    platform: resource.platform,
    scope: resource.scope,
    kind: resource.kind,
    blockKind,
    compat: resource.compat,
    dimmed,
  };
}

export function layoutEcosystemGraph(input: EcosystemLayoutInput): EcosystemLayoutResult {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const filterPlatform = input.filterPlatform ?? ECOSYSTEM_FILTER_ALL;
  const filterResourceIds = input.filterResourceIds ?? null;
  let dimmedCount = 0;

  const blockMetrics = ECOSYSTEM_BLOCK_ORDER.map((blockKind) => {
    const blockResources = input.resources[blockKind] ?? [];
    const units = buildLayoutUnits(blockResources, input.overlaps);
    const content = blockContentSize(units);
    return {
      blockKind,
      units,
      content,
      width: content.width + BLOCK_PADDING * 2,
      height: content.height + BLOCK_HEADER + BLOCK_PADDING * 2,
    };
  });

  const blockPositions = new Map<EcosystemBlockKind, { x: number; y: number }>();
  let blockX = 0;
  for (const block of blockMetrics) {
    blockPositions.set(block.blockKind, { x: blockX, y: 0 });
    blockX += block.width + BLOCK_GAP_X;
  }

  for (const block of blockMetrics) {
    const blockId = `block:${block.blockKind}`;
    const position = blockPositions.get(block.blockKind)!;

    nodes.push({
      id: blockId,
      type: "ecosystemBlock",
      position,
      data: {
        label: ECOSYSTEM_BLOCK_LABELS[block.blockKind],
        blockKind: block.blockKind,
        count: block.units.reduce(
          (count, unit) => count + (unit.type === "pair" ? 2 : 1),
          0,
        ),
        empty: block.units.length === 0,
      } satisfies EcosystemBlockNodeData,
      style: {
        width: block.width,
        height: block.height,
        borderColor: ECOSYSTEM_BLOCK_COLORS[block.blockKind],
        background: "#141820",
        borderRadius: 10,
        padding: 0,
      },
      draggable: false,
      selectable: false,
    });

    if (block.units.length === 0) {
      continue;
    }

    const { columns } = block.content;
    block.units.forEach((unit, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const rowUnits = block.units.slice(row * columns, (row + 1) * columns);
      const rowWidth =
        rowUnits.reduce((sum, rowUnit) => sum + unitWidth(rowUnit), 0) +
        Math.max(0, rowUnits.length - 1) * GRID_GAP_X;
      const unitsBeforeInRow = rowUnits.slice(0, col);
      const xOffset =
        BLOCK_PADDING +
        (block.content.width - rowWidth) / 2 +
        unitsBeforeInRow.reduce(
          (sum, rowUnit) => sum + unitWidth(rowUnit) + GRID_GAP_X,
          0,
        );
      const yOffset = BLOCK_HEADER + BLOCK_PADDING + row * (unitHeight() + GRID_GAP_Y);

      if (unit.type === "single") {
        const data = resourceNodeData(
          unit.resource,
          block.blockKind,
          filterPlatform,
          filterResourceIds,
        );
        if (data.dimmed) {
          dimmedCount += 1;
        }
        nodes.push({
          id: unit.resource.id,
          type: "ecosystemResource",
          parentId: blockId,
          extent: "parent",
          position: { x: xOffset, y: yOffset },
          data: data as unknown as Record<string, unknown>,
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          style: resourceNodeStyle(block.blockKind, data.dimmed),
          className: data.dimmed ? "ecosystem-resource-dimmed" : undefined,
          draggable: false,
        });
        return;
      }

      const [localResource, otherResource] = unit.resources;
      const pairY = yOffset;
      const localData = resourceNodeData(
        localResource,
        block.blockKind,
        filterPlatform,
        filterResourceIds,
      );
      const otherData = resourceNodeData(
        otherResource,
        block.blockKind,
        filterPlatform,
        filterResourceIds,
      );
      if (localData.dimmed) {
        dimmedCount += 1;
      }
      if (otherData.dimmed) {
        dimmedCount += 1;
      }

      nodes.push({
        id: localResource.id,
        type: "ecosystemResource",
        parentId: blockId,
        extent: "parent",
        position: { x: xOffset, y: pairY },
        data: localData as unknown as Record<string, unknown>,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: resourceNodeStyle(block.blockKind, localData.dimmed),
        className: localData.dimmed ? "ecosystem-resource-dimmed" : undefined,
        draggable: false,
      });

      nodes.push({
        id: otherResource.id,
        type: "ecosystemResource",
        parentId: blockId,
        extent: "parent",
        position: {
          x: xOffset + RESOURCE_NODE_WIDTH + PAIR_GAP,
          y: pairY,
        },
        data: otherData as unknown as Record<string, unknown>,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: resourceNodeStyle(block.blockKind, otherData.dimmed),
        className: otherData.dimmed ? "ecosystem-resource-dimmed" : undefined,
        draggable: false,
      });

      const resolved = unit.overlap.collision.effective !== undefined;
      edges.push({
        id: `overlap:${localResource.id}:${otherResource.id}`,
        source: localResource.id,
        target: otherResource.id,
        type: "smoothstep",
        label: resolved ? "overlaps" : "overlaps (unresolved)",
        animated: !resolved,
        style: overlapEdgeStyle(resolved),
        labelStyle: { fill: resolved ? "#81c995" : "#fdd663", fontSize: 10 },
        labelBgStyle: { fill: "#1a1d24", fillOpacity: 0.92 },
        labelBgPadding: [4, 6] as [number, number],
        labelBgBorderRadius: 4,
        data: { resolved },
      });
    });
  }

  return { nodes, edges, dimmedCount };
}

export function isOverlapResolved(overlap: OverlapRelation): boolean {
  return overlap.collision.effective !== undefined;
}
