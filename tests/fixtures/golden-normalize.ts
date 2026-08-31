import path from "node:path";
import type { ManagedSimulationResult } from "../../src/application/simulate.js";
import type {
  EffectiveConfiguration,
  ResolvedCapability,
  SourceInfo,
} from "../../src/core/model/index.js";
import type { ClaudeProjectSnapshot as ProjectSnapshot } from "../../src/adapters/claude/model/index.js";

export interface NormalizedDiscovery {
  agents: unknown[];
  skills: unknown[];
  instructions: unknown[];
  mcpServers: unknown[];
  settings: unknown[];
  trust: unknown;
  environment: unknown;
}

export interface NormalizedResolution {
  agentName: string;
  context: EffectiveConfiguration["context"];
  capabilities: ResolvedCapability[];
  warnings: EffectiveConfiguration["warnings"];
  unknownRate: number;
}

/**
 * Managed simulation delta (§7.8), with agent ids and absolute paths removed
 * so the golden records only which agents become shadowed, which tools are
 * denied, which fields are ignored and which models are substituted (F8).
 */
export interface NormalizedSimulation {
  context: EffectiveConfiguration["context"];
  delta: {
    shadowedAgents: unknown[];
    deniedTools: unknown[];
    modelChanges: unknown[];
    ignoredFields: unknown[];
  };
}

export interface NormalizedGoldenOutput {
  discovery: NormalizedDiscovery;
  resolutions: NormalizedResolution[];
  /** Present only for fixtures that ship a `managed-bundle/` (§7.8). */
  simulation?: NormalizedSimulation;
}

function toPosixRelative(projectRoot: string, value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const normalizedRoot = path.resolve(projectRoot);
  const normalizedValue = path.resolve(value);
  const relative = path.relative(normalizedRoot, normalizedValue);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return value.split(path.sep).join("/");
  }
  return relative.split(path.sep).join("/");
}

function normalizeSource(
  projectRoot: string,
  source: SourceInfo | undefined,
): SourceInfo | undefined {
  if (!source) {
    return undefined;
  }
  return {
    ...source,
    ...(source.path !== undefined
      ? { path: toPosixRelative(projectRoot, source.path) }
      : {}),
  };
}

/**
 * Locale-independent string order, for the same reason the resolver uses one:
 * `localeCompare` follows the host's collation, so a golden ordered with it
 * could be recorded on one machine and fail to reproduce on another.
 */
function compareStrings(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function sortByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  return [...items].sort((left, right) => compareStrings(keyFn(left), keyFn(right)));
}

/**
 * Sort on a tuple of keys, so entries that tie on the first key still have a
 * total order. A name alone is not a key: an A4 collision puts two agents
 * under one name, and a stable sort would then leave them in directory read
 * order — which A4 has no rule for (§13 invariant 2).
 */
function sortByKeys<T>(items: T[], keyFn: (item: T) => string[]): T[] {
  return [...items].sort((left, right) => {
    const leftKeys = keyFn(left);
    const rightKeys = keyFn(right);
    const length = Math.max(leftKeys.length, rightKeys.length);
    for (let index = 0; index < length; index += 1) {
      const comparison = compareStrings(
        leftKeys[index] ?? "",
        rightKeys[index] ?? "",
      );
      if (comparison !== 0) {
        return comparison;
      }
    }
    return 0;
  });
}

/** Total order over sources, used to normalize every source list. */
function sourceKey(source: SourceInfo): string[] {
  return [
    source.platform,
    source.scope,
    source.path ?? "",
    source.fieldPath ?? "",
    source.matrixRef ?? "",
  ];
}

/**
 * A resolution cites the colliding candidates of an ambiguous agent, and their
 * order follows the directory walk. Ordering them here keeps a differently
 * ordered walk from producing a golden diff.
 */
function sortSources<T extends SourceInfo>(sources: readonly T[]): T[] {
  return sortByKeys([...sources], sourceKey);
}

function isWithinProject(projectRoot: string, candidatePath: string | undefined): boolean {
  if (candidatePath === undefined) {
    return false;
  }
  const relative = path.relative(path.resolve(projectRoot), path.resolve(candidatePath));
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

function pathFromRecord(record: Record<string, unknown>): string | undefined {
  const candidates = [record.path, record.configPath];
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      return candidate;
    }
  }
  const source = record.source;
  if (typeof source === "object" && source !== null && "path" in source) {
    const sourcePath = (source as SourceInfo).path;
    if (typeof sourcePath === "string") {
      return sourcePath;
    }
  }
  return undefined;
}

function omitUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

function normalizeDiscovery(
  snapshot: ProjectSnapshot,
  projectRoot: string,
): NormalizedDiscovery {
  const agents = sortByKeys(
    snapshot.agents
      .filter((agent) => agent.source.scope === "builtin" || isWithinProject(projectRoot, agent.source.path))
      .map((agent) => {
        const { id: _id, ...rest } = agent;
        return {
          ...rest,
          ...(rest.configuration
            ? {
                configuration: omitUndefined(
                  rest.configuration as unknown as Record<string, unknown>,
                ),
              }
            : {}),
          source: normalizeSource(projectRoot, agent.source),
          // Collision evidence carries absolute paths too (A3/A4 fixtures).
          ...(agent.collision
            ? {
                collision: {
                  ...agent.collision,
                  candidates: sortSources(
                    agent.collision.candidates.map(
                      (candidate) =>
                        normalizeSource(projectRoot, candidate) ?? candidate,
                    ),
                  ),
                  ...(agent.collision.effective
                    ? {
                        effective: normalizeSource(
                          projectRoot,
                          agent.collision.effective,
                        ),
                      }
                    : {}),
                },
              }
            : {}),
        };
      }),
    (agent) => [
      (agent as { name: string }).name,
      String((agent as { source?: SourceInfo }).source?.path ?? ""),
    ],
  );

  const skills = sortByKey(
    (snapshot.skills as Array<Record<string, unknown>>)
      .filter((skill) => isWithinProject(projectRoot, pathFromRecord(skill)))
      .map((skill) => {
        const { id: _id, ...rest } = skill;
        return {
          ...rest,
          ...(typeof rest.path === "string"
            ? { path: toPosixRelative(projectRoot, rest.path) }
            : {}),
          source: normalizeSource(projectRoot, rest.source as SourceInfo),
        };
      }),
    (skill) => String((skill as { name?: string }).name ?? ""),
  );

  const instructions = sortByKey(
    (snapshot.instructions as Array<Record<string, unknown>>)
      .filter((instruction) => isWithinProject(projectRoot, pathFromRecord(instruction)))
      .map((instruction) => {
        const { id: _id, ...rest } = instruction;
        return {
          ...rest,
          ...(typeof rest.path === "string"
            ? { path: toPosixRelative(projectRoot, rest.path) }
            : {}),
        };
      }),
    (instruction) => String((instruction as { path?: string }).path ?? ""),
  );

  const mcpServers = sortByKey(
    (snapshot.mcpServers as Array<Record<string, unknown>>)
      .filter((server) => isWithinProject(projectRoot, pathFromRecord(server)))
      .map((server) => {
        const { id: _id, ...rest } = server;
        return {
          ...rest,
          ...(typeof rest.configPath === "string"
            ? { configPath: toPosixRelative(projectRoot, rest.configPath) }
            : {}),
          source: normalizeSource(projectRoot, rest.source as SourceInfo),
        };
      }),
    (server) => String((server as { configPath?: string }).configPath ?? ""),
  );

  // Every layer inside the project, not just `scope: "project"`: the S1
  // outcome is decided by `.claude/settings.local.json` outranking
  // `.claude/settings.json`, and a golden that hid the local layer could not
  // show which layer a verdict came from. The user layer stays out because it
  // is machine-specific, which `isWithinProject` already handles.
  const settings = sortByKey(
    (snapshot.settings as Array<Record<string, unknown>>)
      .filter((layer) => isWithinProject(projectRoot, pathFromRecord(layer)))
      .map((layer) => ({
        ...layer,
        ...(typeof layer.path === "string"
          ? { path: toPosixRelative(projectRoot, layer.path) }
          : {}),
      })),
    (layer) =>
      `${String((layer as { scope?: string; path?: string }).scope)}:${String(layer.path)}`,
  );

  const environment = {
    relevant: sortByKey([...snapshot.environment.relevant], (entry) => entry.key),
  };

  return {
    agents,
    skills,
    instructions,
    mcpServers,
    settings,
    trust: {
      accepted: snapshot.trust.accepted,
      projectPath: ".",
    },
    environment,
  };
}

function isAgentHooksCapability(capability: ResolvedCapability): boolean {
  return (
    capability.capabilityId === "agent-hooks" ||
    capability.sources.some((source) => source.fieldPath === "frontmatter.hooks")
  );
}

function normalizeCapabilityId(
  capability: ResolvedCapability,
  projectRoot: string,
): string {
  if (capability.kind === "mcp_server" && capability.capabilityId.startsWith("mcp-server:")) {
    const sourcePath = capability.sources[0]?.path;
    if (sourcePath) {
      return `mcp-server:${toPosixRelative(projectRoot, sourcePath)}`;
    }
  }

  if (isAgentHooksCapability(capability)) {
    const sourcePath = capability.sources[0]?.path;
    if (sourcePath) {
      return `hooks:${toPosixRelative(projectRoot, sourcePath)}`;
    }
  }

  if (capability.kind === "instruction") {
    const sourcePath = capability.sources[0]?.path;
    if (sourcePath) {
      return `instruction:${toPosixRelative(projectRoot, sourcePath)}`;
    }
  }

  return capability.capabilityId;
}

function normalizeCapability(
  capability: ResolvedCapability,
  projectRoot: string,
): ResolvedCapability {
  const sources = sortSources(
    capability.sources.map(
      (source) => normalizeSource(projectRoot, source) ?? source,
    ),
  );
  return {
    ...capability,
    capabilityId: normalizeCapabilityId({ ...capability, sources }, projectRoot),
    sources,
    reasons: capability.reasons.map((reason) => ({
      ...reason,
      ...(reason.source
        ? { source: normalizeSource(projectRoot, reason.source) }
        : {}),
    })),
  };
}

function capabilityWithinProject(
  capability: ResolvedCapability,
  projectRoot: string,
): boolean {
  return capability.sources.every(
    (source) => source.path === undefined || isWithinProject(projectRoot, source.path),
  );
}

function normalizeResolution(
  resolution: EffectiveConfiguration,
  agentName: string,
  projectRoot: string,
): NormalizedResolution {
  const { agentId: _agentId, version: _version, ...rest } = resolution;
  return {
    agentName,
    context: rest.context,
    capabilities: rest.capabilities
      .filter((capability) => capabilityWithinProject(capability, projectRoot))
      .map((capability) => normalizeCapability(capability, projectRoot)),
    warnings: sortByKey(rest.warnings, (warning) => warning.message).map((warning) => ({
      ...warning,
      evidence: sortSources(
        warning.evidence.map(
          (source) => normalizeSource(projectRoot, source) ?? source,
        ),
      ),
    })),
    unknownRate: rest.unknownRate,
  };
}

/**
 * Strip the ids and absolute paths from a §7.8 simulation result. Bundle path
 * and snapshot id are dropped: they are machine-specific and say nothing about
 * the delta the fixture asserts.
 */
function normalizeSimulation(
  simulation: ManagedSimulationResult,
  projectRoot: string,
): NormalizedSimulation {
  // The managed bundle sits next to `project/`, so its paths are normalized
  // against the fixture directory and stay relative in the golden.
  const fixtureRoot = path.dirname(path.resolve(projectRoot));
  const stripAgentId = <T extends { agentId: string }>(entry: T): Omit<T, "agentId"> => {
    const { agentId: _agentId, ...rest } = entry;
    return rest;
  };

  return {
    context: simulation.context,
    delta: {
      shadowedAgents: simulation.delta.shadowedAgents.map((entry) => ({
        ...stripAgentId(entry),
        shadowedBy: normalizeSource(fixtureRoot, entry.shadowedBy),
      })),
      deniedTools: simulation.delta.deniedTools.map(stripAgentId),
      modelChanges: simulation.delta.modelChanges.map((entry) => ({
        ...stripAgentId(entry),
        source: normalizeSource(fixtureRoot, entry.source),
      })),
      ignoredFields: simulation.delta.ignoredFields.map((entry) => ({
        ...stripAgentId(entry),
        evidence: entry.evidence.map(
          (source) => normalizeSource(fixtureRoot, source) ?? source,
        ),
      })),
    },
  };
}

export function normalizeGoldenOutput(
  snapshot: ProjectSnapshot,
  resolutions: Array<{ agentName: string; resolution: EffectiveConfiguration }>,
  projectRoot: string,
  simulation?: ManagedSimulationResult,
): NormalizedGoldenOutput {
  return {
    discovery: normalizeDiscovery(snapshot, projectRoot),
    resolutions: resolutions.map(({ agentName, resolution }) =>
      normalizeResolution(resolution, agentName, projectRoot),
    ),
    ...(simulation
      ? { simulation: normalizeSimulation(simulation, projectRoot) }
      : {}),
  };
}
