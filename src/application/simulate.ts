import path from "node:path";
import type {
  EffectiveConfiguration,
  SourceInfo,
} from "../core/model/index.js";
import type {
  ClaudeAgent as Agent,
  ClaudeProjectSnapshot as ProjectSnapshot,
} from "../adapters/claude/model/index.js";
import { buildExecutionContext } from "../adapters/claude/resolution/context.js";
import {
  applyManagedOverlay,
  loadManagedBundle,
  ManagedBundleError,
  resolveManagedModel,
  type ManagedBundle,
} from "../adapters/claude/discovery/managed-overlay.js";
import { resolveEffectiveConfiguration } from "../adapters/claude/resolution/resolver.js";
import { FACT } from "../adapters/claude/version/facts.js";
import { getLastScan, getOrScan } from "./scan-store.js";

export { ManagedBundleError } from "../adapters/claude/discovery/managed-overlay.js";

export interface ShadowedAgentDelta {
  agentId: string;
  agentName: string;
  previousStatus: Agent["status"];
  newStatus: "shadowed";
  shadowedBy: SourceInfo;
}

export interface DeniedToolDelta {
  agentId: string;
  agentName: string;
  capabilityId: string;
  previousStatus: "available" | "preloaded";
  reason: string;
}

export interface ModelChangeDelta {
  agentId: string;
  agentName: string;
  declared: string;
  effective: string;
  source: SourceInfo;
  matrixRef: typeof FACT.F8;
}

export interface IgnoredFieldDelta {
  agentId: string;
  agentName: string;
  field: string;
  message: string;
  evidence: SourceInfo[];
}

export interface ManagedSimulationDelta {
  shadowedAgents: ShadowedAgentDelta[];
  deniedTools: DeniedToolDelta[];
  modelChanges: ModelChangeDelta[];
  ignoredFields: IgnoredFieldDelta[];
}

export interface ManagedSimulationResult {
  snapshotId: string;
  bundlePath: string;
  context: EffectiveConfiguration["context"];
  delta: ManagedSimulationDelta;
}

export interface SimulateManagedOptions {
  managedBundlePath: string;
  projectPath?: string;
  snapshot?: ProjectSnapshot;
}

function indexAgentsById(agents: Agent[]): Map<string, Agent> {
  return new Map(agents.map((agent) => [agent.id, agent]));
}

function findShadowedAgents(
  baselineAgents: Agent[],
  simulatedAgents: Agent[],
): ShadowedAgentDelta[] {
  const simulatedById = indexAgentsById(simulatedAgents);
  const deltas: ShadowedAgentDelta[] = [];

  for (const baseline of baselineAgents) {
    if (baseline.status !== "active") {
      continue;
    }

    const simulated = simulatedById.get(baseline.id);
    if (!simulated || simulated.status !== "shadowed" || !simulated.collision?.effective) {
      continue;
    }

    deltas.push({
      agentId: baseline.id,
      agentName: baseline.name,
      previousStatus: baseline.status,
      newStatus: "shadowed",
      shadowedBy: simulated.collision.effective,
    });
  }

  return deltas.sort((left, right) => left.agentName.localeCompare(right.agentName));
}

function findDeniedTools(
  baselineEffective: EffectiveConfiguration,
  simulatedEffective: EffectiveConfiguration,
  agentName: string,
): DeniedToolDelta[] {
  const baselineById = new Map(
    baselineEffective.capabilities.map((capability) => [capability.capabilityId, capability]),
  );
  const deltas: DeniedToolDelta[] = [];

  for (const simulatedCapability of simulatedEffective.capabilities) {
    if (simulatedCapability.status !== "denied") {
      continue;
    }
    if (simulatedCapability.kind !== "tool" && simulatedCapability.kind !== "mcp_tool") {
      continue;
    }

    const baselineCapability = baselineById.get(simulatedCapability.capabilityId);
    if (
      !baselineCapability ||
      (baselineCapability.status !== "available" && baselineCapability.status !== "preloaded")
    ) {
      continue;
    }

    deltas.push({
      agentId: simulatedEffective.agentId,
      agentName,
      capabilityId: simulatedCapability.capabilityId,
      previousStatus: baselineCapability.status,
      reason:
        simulatedCapability.reasons[0]?.message ??
        "Tool denied after managed overlay.",
    });
  }

  return deltas;
}

function findModelChanges(
  agent: Agent,
  availableModels: readonly string[] | undefined,
): ModelChangeDelta[] {
  const declared = agent.configuration.model;
  if (!declared) {
    return [];
  }

  const resolved = resolveManagedModel(declared, availableModels);
  if (!resolved.substituted || !resolved.effective) {
    return [];
  }

  return [
    {
      agentId: agent.id,
      agentName: agent.name,
      declared: resolved.declared!,
      effective: resolved.effective,
      source: { ...agent.source, fieldPath: "frontmatter.model" },
      matrixRef: FACT.F8,
    },
  ];
}

function findIgnoredFields(
  baselineEffective: EffectiveConfiguration,
  simulatedEffective: EffectiveConfiguration,
  agentName: string,
): IgnoredFieldDelta[] {
  const baselineMessages = new Set(
    baselineEffective.warnings
      .filter((warning) => warning.category === "ignored-field")
      .map((warning) => warning.message),
  );

  const deltas: IgnoredFieldDelta[] = [];
  for (const warning of simulatedEffective.warnings) {
    if (warning.category !== "ignored-field" || baselineMessages.has(warning.message)) {
      continue;
    }

    const field =
      warning.evidence[0]?.fieldPath?.replace(/^frontmatter\./, "") ?? "unknown";

    deltas.push({
      agentId: simulatedEffective.agentId,
      agentName,
      field,
      message: warning.message,
      evidence: warning.evidence,
    });
  }

  return deltas;
}

async function resolveActiveAgents(
  snapshot: ProjectSnapshot,
  context: EffectiveConfiguration["context"],
): Promise<EffectiveConfiguration[]> {
  const activeAgents = snapshot.agents.filter((agent) => agent.status === "active");
  return Promise.all(
    activeAgents.map((agent) =>
      resolveEffectiveConfiguration(snapshot, agent.id, context),
    ),
  );
}

function indexActiveAgentsByName(agents: Agent[]): Map<string, Agent> {
  const result = new Map<string, Agent>();
  for (const agent of agents) {
    if (agent.status === "active") {
      result.set(agent.name, agent);
    }
  }
  return result;
}

function buildDelta(
  baselineSnapshot: ProjectSnapshot,
  simulatedSnapshot: ProjectSnapshot,
  bundle: ManagedBundle,
  baselineEffective: EffectiveConfiguration[],
  simulatedEffective: EffectiveConfiguration[],
): ManagedSimulationDelta {
  const shadowedAgents = findShadowedAgents(
    baselineSnapshot.agents,
    simulatedSnapshot.agents,
  );

  const baselineActiveByName = indexActiveAgentsByName(baselineSnapshot.agents);
  const baselineEffectiveByAgentId = new Map(
    baselineEffective.map((effective) => [effective.agentId, effective]),
  );
  const simulatedActiveByName = indexActiveAgentsByName(simulatedSnapshot.agents);

  const deniedTools: DeniedToolDelta[] = [];
  const ignoredFields: IgnoredFieldDelta[] = [];
  const modelChanges: ModelChangeDelta[] = [];

  for (const simulatedConfig of simulatedEffective) {
    const simulatedAgent = simulatedSnapshot.agents.find(
      (agent) => agent.id === simulatedConfig.agentId,
    );
    if (!simulatedAgent) {
      continue;
    }

    const baselineAgent = baselineActiveByName.get(simulatedAgent.name);
    const baselineConfig = baselineAgent
      ? baselineEffectiveByAgentId.get(baselineAgent.id)
      : undefined;

    if (baselineConfig) {
      deniedTools.push(
        ...findDeniedTools(baselineConfig, simulatedConfig, simulatedAgent.name),
      );
      ignoredFields.push(
        ...findIgnoredFields(baselineConfig, simulatedConfig, simulatedAgent.name),
      );
    }

    modelChanges.push(...findModelChanges(simulatedAgent, bundle.availableModels));
  }

  for (const [name, baselineAgent] of baselineActiveByName) {
    if (simulatedActiveByName.has(name)) {
      continue;
    }
    const baselineConfig = baselineEffectiveByAgentId.get(baselineAgent.id);
    if (!baselineConfig) {
      continue;
    }
    modelChanges.push(...findModelChanges(baselineAgent, bundle.availableModels));
  }

  deniedTools.sort((left, right) =>
    left.agentName.localeCompare(right.agentName) ||
    left.capabilityId.localeCompare(right.capabilityId),
  );
  ignoredFields.sort((left, right) =>
    left.agentName.localeCompare(right.agentName) ||
    left.field.localeCompare(right.field),
  );
  modelChanges.sort((left, right) => left.agentName.localeCompare(right.agentName));

  return {
    shadowedAgents,
    deniedTools,
    modelChanges,
    ignoredFields,
  };
}

/**
 * Simulate managed policy overlay on a project snapshot (read-only).
 * @see docs/SPEC.md §7.8
 */
export async function simulateManagedOverlay(
  options: SimulateManagedOptions,
): Promise<ManagedSimulationResult> {
  const bundle = await loadManagedBundle(options.managedBundlePath);

  let baselineSnapshot: ProjectSnapshot;
  if (options.snapshot) {
    baselineSnapshot = options.snapshot;
  } else if (options.projectPath) {
    const scanResult = await getOrScan(options.projectPath);
    baselineSnapshot = scanResult.snapshot;
  } else {
    const scanResult = getLastScan() ?? (await getOrScan());
    baselineSnapshot = scanResult.snapshot;
  }

  const simulatedSnapshot = applyManagedOverlay(baselineSnapshot, bundle);
  const context = buildExecutionContext("main-session");

  const [baselineEffective, simulatedEffective] = await Promise.all([
    resolveActiveAgents(baselineSnapshot, context),
    resolveActiveAgents(simulatedSnapshot, context),
  ]);

  return {
    snapshotId: baselineSnapshot.id,
    bundlePath: path.resolve(bundle.bundlePath),
    context,
    delta: buildDelta(
      baselineSnapshot,
      simulatedSnapshot,
      bundle,
      baselineEffective,
      simulatedEffective,
    ),
  };
}
