import path from "node:path";
import type { CompatVerdict } from "../../src/core/compat/index.js";
import type {
  InventoryResourceKind,
  OverlapRelation,
  PlatformDetection,
} from "../../src/core/model/index.js";
import type {
  EcosystemApiPayload,
  InventoryResourceWithCompat,
} from "../../src/server/routes/ecosystem.js";

export interface NormalizedCompatVerdicts {
  claude: CompatVerdict;
  cursor: CompatVerdict;
  codex: CompatVerdict;
}

export interface NormalizedInventoryResource {
  id: string;
  kind: InventoryResourceKind;
  platform: string;
  scope: string;
  resourceClass: string;
  path?: string;
  name?: string;
  compat: NormalizedCompatVerdicts;
}

export interface NormalizedEcosystemGoldenOutput {
  detection: PlatformDetection[];
  resources: Record<InventoryResourceKind, NormalizedInventoryResource[]>;
  overlaps: OverlapRelation[];
}

function toFixtureRelativePath(
  fixtureDir: string,
  projectRoot: string,
  value: string | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const resolved = path.resolve(value);
  const homeRoot = path.resolve(fixtureDir, "home");
  const homeRelative = path.relative(homeRoot, resolved);
  if (!homeRelative.startsWith("..") && !path.isAbsolute(homeRelative)) {
    return `home/${homeRelative.split(path.sep).join("/")}`;
  }

  const projectRelative = path.relative(path.resolve(projectRoot), resolved);
  if (!projectRelative.startsWith("..") && !path.isAbsolute(projectRelative)) {
    return projectRelative.split(path.sep).join("/");
  }

  return value.split(path.sep).join("/");
}

function compareStrings(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function sortByKeys<T>(items: T[], keyFn: (item: T) => string[]): T[] {
  return [...items].sort((left, right) => {
    const leftKeys = keyFn(left);
    const rightKeys = keyFn(right);
    for (let index = 0; index < Math.max(leftKeys.length, rightKeys.length); index += 1) {
      const diff = compareStrings(leftKeys[index] ?? "", rightKeys[index] ?? "");
      if (diff !== 0) {
        return diff;
      }
    }
    return 0;
  });
}

function normalizeDetection(
  fixtureDir: string,
  projectRoot: string,
  detection: PlatformDetection[],
): PlatformDetection[] {
  return sortByKeys(detection, (entry) => [entry.platform]).map((entry) => ({
    ...entry,
    evidence: sortByKeys(entry.evidence, (evidence) => [
      evidence.platform,
      evidence.scope,
      evidence.path ?? "",
      evidence.matrixRef ?? "",
    ]).map((evidence) => ({
      ...evidence,
      ...(evidence.path !== undefined
        ? { path: toFixtureRelativePath(fixtureDir, projectRoot, evidence.path) }
        : {}),
    })),
  }));
}

function normalizeCompat(compat: InventoryResourceWithCompat["compat"]): NormalizedCompatVerdicts {
  return {
    claude: compat.claude ?? { support: "unknown", enforcement: "unknown" },
    cursor: compat.cursor ?? { support: "unknown", enforcement: "unknown" },
    codex: compat.codex ?? { support: "unknown", enforcement: "unknown" },
  };
}

const CODEX_MAIN_AGENT_PREFIX = "codex-main:";

/**
 * Inventory resource ids are derived from absolute paths (hashes or, for Codex
 * XA1, an explicit `codex-main:<path>` suffix). Normalize them to
 * fixture-relative paths so a golden recorded on one machine reproduces from
 * unrelated checkout roots (same approach as instruction capability ids in
 * `golden-normalize.ts`).
 */
function normalizeResourceIdSuffix(
  kind: InventoryResourceKind,
  resourceId: string,
  relativePath: string | undefined,
  name: string | undefined,
): string {
  if (resourceId.startsWith(CODEX_MAIN_AGENT_PREFIX)) {
    const embeddedPath = resourceId.slice(CODEX_MAIN_AGENT_PREFIX.length);
    if (path.isAbsolute(embeddedPath) && relativePath !== undefined) {
      return `${CODEX_MAIN_AGENT_PREFIX}${relativePath}`;
    }
    if (relativePath !== undefined) {
      return `${CODEX_MAIN_AGENT_PREFIX}${relativePath}`;
    }
  }

  if (relativePath === undefined) {
    return resourceId;
  }

  switch (kind) {
    case "instruction":
      return `instruction:${relativePath}`;
    case "skill":
      return `skill:${relativePath}`;
    case "mcp_server":
      return name !== undefined ? `mcp:${relativePath}:${name}` : `mcp:${relativePath}`;
    case "agent":
      return relativePath;
    default:
      return resourceId;
  }
}

function normalizeResourceId(
  platform: string,
  kind: InventoryResourceKind,
  resourceId: string,
  relativePath: string | undefined,
  name: string | undefined,
): string {
  const suffix = normalizeResourceIdSuffix(kind, resourceId, relativePath, name);
  return `${platform}:${kind}:${suffix}`;
}

function normalizeResource(
  fixtureDir: string,
  projectRoot: string,
  resource: InventoryResourceWithCompat,
): NormalizedInventoryResource {
  const relativePath =
    resource.path !== undefined
      ? toFixtureRelativePath(fixtureDir, projectRoot, resource.path)
      : undefined;
  const [, , ...resourceIdParts] = resource.id.split(":");
  const rawResourceId = resourceIdParts.join(":");

  return {
    id: normalizeResourceId(
      resource.platform,
      resource.kind,
      rawResourceId,
      relativePath,
      resource.name,
    ),
    kind: resource.kind,
    platform: resource.platform,
    scope: resource.scope,
    resourceClass: resource.resourceClass,
    ...(resource.name !== undefined ? { name: resource.name } : {}),
    ...(relativePath !== undefined ? { path: relativePath } : {}),
    compat: normalizeCompat(resource.compat),
  };
}

function normalizeOverlaps(
  fixtureDir: string,
  projectRoot: string,
  overlaps: OverlapRelation[],
  idRemap: Map<string, string>,
): OverlapRelation[] {
  return sortByKeys(overlaps, (overlap) => [...overlap.ids]).map((overlap) => {
    const ids = overlap.ids.map((id) => idRemap.get(id) ?? id).sort(compareStrings) as [
      string,
      string,
    ];
    return {
      ids,
      collision: {
      ...overlap.collision,
      candidates: sortByKeys(overlap.collision.candidates, (candidate) => [
        candidate.platform,
        candidate.scope,
        candidate.path ?? "",
      ]).map((candidate) => ({
        ...candidate,
        ...(candidate.path !== undefined
          ? { path: toFixtureRelativePath(fixtureDir, projectRoot, candidate.path) }
          : {}),
      })),
      ...(overlap.collision.effective !== undefined
        ? {
            effective: {
              ...overlap.collision.effective,
              ...(overlap.collision.effective.path !== undefined
                ? {
                    path: toFixtureRelativePath(
                      fixtureDir,
                      projectRoot,
                      overlap.collision.effective.path,
                    ),
                  }
                : {}),
            },
          }
        : {}),
      },
    };
  });
}

export function normalizeEcosystemGoldenOutput(
  payload: EcosystemApiPayload,
  fixtureDir: string,
  projectRoot: string,
): NormalizedEcosystemGoldenOutput {
  const resources = {} as Record<InventoryResourceKind, NormalizedInventoryResource[]>;
  const idRemap = new Map<string, string>();

  for (const kind of Object.keys(payload.resources) as InventoryResourceKind[]) {
    resources[kind] = sortByKeys(
      payload.resources[kind].map((resource) => {
        const normalized = normalizeResource(fixtureDir, projectRoot, resource);
        idRemap.set(resource.id, normalized.id);
        return normalized;
      }),
      (resource) => [resource.platform, resource.kind, resource.id],
    );
  }

  return {
    detection: normalizeDetection(fixtureDir, projectRoot, payload.detection),
    resources,
    overlaps: normalizeOverlaps(fixtureDir, projectRoot, payload.overlaps, idRemap),
  };
}
