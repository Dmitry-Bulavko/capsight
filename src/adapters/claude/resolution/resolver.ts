import fs from "node:fs/promises";
import type {
  Agent,
  EffectiveConfiguration,
  ExecutionContext,
  ProjectSnapshot,
  ResolutionReason,
  ResolvedCapability,
  SourceInfo,
  Warning,
} from "../../../core/model/index.js";
import {
  AGENT_TOOL_NAMES,
  BACKGROUND_ALLOWED_BUILTIN_TOOLS,
  FILTER_1_REMOVED_TOOLS,
  applyContextFilters,
  isMcpTool,
  type ContextFilterRemoval,
} from "../../../core/resolver/index.js";
import type { DiscoveredInstruction, DiscoveredMcpServer, SettingsLayer } from "../discovery/types.js";
import {
  resolvePermissionMode,
  type PermissionSettings,
} from "./permissions.js";
import { resolvePluginFieldLimitations } from "./plugin.js";
import {
  resolveMcpConfigFileTrust,
  resolveTrustGate,
  type ResolveTrustResult,
} from "./trust.js";
import { resolveSecurityFindings } from "./security-findings.js";
import { buildSkillPreloadCapabilities } from "./skills.js";
import { resolveAgentTools } from "./tools.js";

export class AgentNotFoundError extends Error {
  constructor(agentId: string) {
    super(`Agent not found: ${agentId}`);
    this.name = "AgentNotFoundError";
  }
}

const PARENT_SESSION_SOURCE: SourceInfo = {
  platform: "claude",
  scope: "unknown",
  fieldPath: "parent-session.tool-pool",
};

const BUILTIN_PARENT_POOL = [
  ...new Set<string>([
    ...BACKGROUND_ALLOWED_BUILTIN_TOOLS,
    ...FILTER_1_REMOVED_TOOLS,
    ...AGENT_TOOL_NAMES,
  ]),
];

function makeReason(
  type: ResolutionReason["type"],
  message: string,
  source?: SourceInfo,
  matrixRef?: string,
): ResolutionReason {
  return matrixRef
    ? { type, message, source, matrixRef }
    : source
      ? { type, message, source }
      : { type, message };
}

function capabilityKind(toolName: string): ResolvedCapability["kind"] {
  return isMcpTool(toolName) ? "mcp_tool" : "tool";
}

/**
 * Map a trust resolution outcome onto capability status/enforcement.
 * An `unknown` trust outcome must never collapse to available or blocked.
 * @see docs/SPEC.md §13 invariants 3, 4
 */
function trustOutcome(status: ResolveTrustResult["status"]): {
  status: ResolvedCapability["status"];
  enforcement: ResolvedCapability["enforcement"];
} {
  switch (status) {
    case "blocked_by_trust":
      return { status: "blocked", enforcement: "enforced" };
    case "unknown":
      return { status: "unknown", enforcement: "unknown" };
    default:
      return { status: "available", enforcement: "enforced" };
  }
}

function buildParentToolPool(agent: Agent): string[] {
  const pool = new Set<string>(BUILTIN_PARENT_POOL);
  for (const pattern of [
    ...(agent.configuration.tools ?? []),
    ...(agent.configuration.disallowedTools ?? []),
  ]) {
    if (!pattern.includes("*") && !pattern.includes("(")) {
      pool.add(pattern);
    }
  }
  return BUILTIN_PARENT_POOL.concat(
    [...pool].filter((tool) => !BUILTIN_PARENT_POOL.includes(tool)).sort(),
  );
}

async function readPermissionSettings(
  settingsLayers: unknown[],
): Promise<PermissionSettings> {
  const layers = settingsLayers as SettingsLayer[];
  const sorted = [...layers].sort((a, b) => b.priority - a.priority);

  for (const layer of sorted) {
    try {
      const raw = await fs.readFile(layer.path, "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        (parsed as Record<string, unknown>).permissions &&
        typeof (parsed as Record<string, { disableBypassPermissionsMode?: boolean }>)
          .permissions === "object"
      ) {
        const permissions = (
          parsed as { permissions: { disableBypassPermissionsMode?: boolean } }
        ).permissions;
        if (permissions.disableBypassPermissionsMode === true) {
          return { disableBypassPermissionsMode: true };
        }
      }
    } catch {
      continue;
    }
  }

  return {};
}

function agentForPermissionResolution(agent: Agent): Agent {
  if (!agent.isPluginAgent || agent.configuration.permissionMode === undefined) {
    return agent;
  }
  return {
    ...agent,
    configuration: {
      ...agent.configuration,
      permissionMode: undefined,
    },
  };
}

function buildForkToolCapabilities(
  parentPool: readonly string[],
  forkReason: ResolutionReason,
): ResolvedCapability[] {
  return parentPool.map((toolName) => ({
    capabilityId: toolName,
    kind: capabilityKind(toolName),
    status: "available" as const,
    enforcement: "unknown" as const,
    sources: [PARENT_SESSION_SOURCE],
    reasons: [forkReason],
  }));
}

function applyFilterRemovals(
  capabilities: ResolvedCapability[],
  removals: readonly ContextFilterRemoval[],
): ResolvedCapability[] {
  const byId = new Map(capabilities.map((capability) => [capability.capabilityId, capability]));

  for (const removal of removals) {
    const existing = byId.get(removal.tool);
    if (existing) {
      byId.set(removal.tool, {
        ...existing,
        status: "denied",
        enforcement: "enforced",
        reasons: [...existing.reasons, removal.reason],
      });
      continue;
    }

    byId.set(removal.tool, {
      capabilityId: removal.tool,
      kind: capabilityKind(removal.tool),
      status: "denied",
      enforcement: "enforced",
      sources: [PARENT_SESSION_SOURCE],
      reasons: [removal.reason],
    });
  }

  return [...byId.values()];
}

function applyBuiltinKindDenials(
  capabilities: ResolvedCapability[],
  context: ExecutionContext,
  agentSource: SourceInfo,
): ResolvedCapability[] {
  if (context.builtinKind !== "explore" && context.builtinKind !== "plan") {
    return capabilities;
  }

  const byId = new Map(capabilities.map((capability) => [capability.capabilityId, capability]));

  for (const toolName of ["Write", "Edit"] as const) {
    const existing = byId.get(toolName);
    const reason = makeReason(
      "denied",
      "Write and Edit are denied for Explore/Plan built-in agents (B2).",
      agentSource,
      "B2",
    );

    if (existing) {
      byId.set(toolName, {
        ...existing,
        status: "denied",
        enforcement: "enforced",
        reasons: [...existing.reasons, reason],
      });
      continue;
    }

    byId.set(toolName, {
      capabilityId: toolName,
      kind: "tool",
      status: "denied",
      enforcement: "enforced",
      sources: [agentSource],
      reasons: [reason],
    });
  }

  return [...byId.values()];
}

function buildPermissionCapability(
  agent: Agent,
  permissionResult: ReturnType<typeof resolvePermissionMode>,
): ResolvedCapability {
  return {
    capabilityId: `permission:${permissionResult.effective}`,
    kind: "permission",
    status: "available",
    enforcement: "enforced",
    sources: [agent.source],
    reasons: permissionResult.reasons,
  };
}

function buildInstructionCapabilities(
  snapshot: ProjectSnapshot,
  context: ExecutionContext,
): ResolvedCapability[] {
  if (context.builtinKind === "explore" || context.builtinKind === "plan") {
    return [];
  }

  const instructions = snapshot.instructions as DiscoveredInstruction[];
  return instructions.map((instruction) => ({
    capabilityId: instruction.id,
    kind: "instruction" as const,
    status: "available" as const,
    enforcement: "advisory" as const,
    sources: [
      {
        platform: "claude" as const,
        scope: instruction.scope,
        path: instruction.path,
      },
    ],
    reasons: [
      makeReason(
        "declared",
        "Instruction source loaded into session context (I1).",
        {
          platform: "claude",
          scope: instruction.scope,
          path: instruction.path,
        },
        "I1",
      ),
    ],
  }));
}

function buildMcpServerCapabilities(snapshot: ProjectSnapshot): ResolvedCapability[] {
  const servers = snapshot.mcpServers as DiscoveredMcpServer[];

  return servers.map((server) => {
    const trustResult = resolveMcpConfigFileTrust(server.source);
    const outcome = trustOutcome(trustResult.status);
    return {
      capabilityId: `mcp-server:${server.id}`,
      kind: "mcp_server" as const,
      status: outcome.status,
      enforcement: outcome.enforcement,
      sources: [server.source],
      reasons: trustResult.reasons,
    };
  });
}

function buildTrustCapabilities(agent: Agent, snapshot: ProjectSnapshot): ResolvedCapability[] {
  if (agent.isPluginAgent) {
    return [];
  }

  const capabilities: ResolvedCapability[] = [];

  for (const [index, entry] of (agent.configuration.mcpServers ?? []).entries()) {
    const trustResult = resolveTrustGate({
      agent,
      trust: snapshot.trust,
      kind: "inline-mcp",
      mcpServerEntry: entry,
      mcpServerIndex: index,
    });

    const outcome = trustOutcome(trustResult.status);
    capabilities.push({
      capabilityId: `inline-mcp:${index}`,
      kind: "mcp_server",
      status: outcome.status,
      enforcement: outcome.enforcement,
      sources: [
        {
          ...agent.source,
          fieldPath: `frontmatter.mcpServers[${index}]`,
        },
      ],
      reasons: trustResult.reasons,
    });
  }

  if (agent.configuration.hooks !== undefined && agent.configuration.hooks !== null) {
    const trustResult = resolveTrustGate({
      agent,
      trust: snapshot.trust,
      kind: "agent-hooks",
    });

    const outcome = trustOutcome(trustResult.status);
    capabilities.push({
      capabilityId: "agent-hooks",
      kind: "instruction",
      status: outcome.status,
      enforcement: outcome.enforcement,
      sources: [{ ...agent.source, fieldPath: "frontmatter.hooks" }],
      reasons: trustResult.reasons,
    });
  }

  return capabilities;
}

function buildIgnoredFieldWarnings(
  agent: Agent,
  permissionResult: ReturnType<typeof resolvePermissionMode>,
  pluginLimitations: ReturnType<typeof resolvePluginFieldLimitations>,
): Warning[] {
  const warnings: Warning[] = [];

  if (permissionResult.ineffective && permissionResult.declared !== undefined) {
    warnings.push({
      category: "ignored-field",
      severity: "warning",
      message: `Declared permissionMode "${permissionResult.declared}" is not effective in this context.`,
      evidence: [{ ...agent.source, fieldPath: "frontmatter.permissionMode" }],
      matrixRef: permissionResult.reasons[0]?.matrixRef,
    });
  }

  for (const limitation of pluginLimitations) {
    warnings.push({
      category: "ignored-field",
      severity: "warning",
      message: limitation.reasons[0]?.message ?? `Plugin agents ignore frontmatter ${limitation.field} (F9).`,
      evidence: [{ ...agent.source, fieldPath: `frontmatter.${limitation.field}` }],
      matrixRef: "F9",
    });
  }

  return warnings;
}

function computeUnknownRate(capabilities: ResolvedCapability[]): number {
  if (capabilities.length === 0) {
    return 0;
  }

  const unknownCount = capabilities.filter(
    (capability) =>
      capability.status === "unknown" || capability.enforcement === "unknown",
  ).length;

  return unknownCount / capabilities.length;
}

function sortCapabilities(capabilities: ResolvedCapability[]): ResolvedCapability[] {
  const kindOrder: Record<ResolvedCapability["kind"], number> = {
    permission: 0,
    tool: 1,
    mcp_tool: 2,
    mcp_server: 3,
    instruction: 4,
    skill: 5,
  };

  return [...capabilities].sort((left, right) => {
    const kindDiff = kindOrder[left.kind] - kindOrder[right.kind];
    if (kindDiff !== 0) {
      return kindDiff;
    }
    return left.capabilityId.localeCompare(right.capabilityId);
  });
}

/**
 * Resolve effective configuration for an agent in context.
 * @see docs/SPEC.md §4.4, §7.3
 */
export async function resolveEffectiveConfiguration(
  snapshot: ProjectSnapshot,
  agentId: string,
  context: ExecutionContext,
): Promise<EffectiveConfiguration> {
  const agent = snapshot.agents.find((entry) => entry.id === agentId);
  if (!agent) {
    throw new AgentNotFoundError(agentId);
  }

  const permissionSettings = await readPermissionSettings(snapshot.settings);
  const permissionResult = resolvePermissionMode(
    agentForPermissionResolution(agent),
    context,
    permissionSettings,
  );
  const pluginLimitations = resolvePluginFieldLimitations(agent);
  const parentPool = buildParentToolPool(agent);

  let toolCapabilities: ResolvedCapability[];

  if (context.isFork) {
    const forkReason = makeReason(
      "context-filter",
      "Fork inherits parent session tool pool; agent configuration filters are not applied (T3).",
      agent.source,
      "T3",
    );
    toolCapabilities = buildForkToolCapabilities(parentPool, forkReason);
  } else {
    const toolsResult = resolveAgentTools({
      parentPool,
      tools: agent.configuration.tools,
      disallowedTools: agent.configuration.disallowedTools,
      agentSource: agent.source,
    });
    const filterResult = applyContextFilters(toolsResult.pool, context);
    toolCapabilities = applyFilterRemovals(toolsResult.capabilities, filterResult.removals);
    toolCapabilities = applyBuiltinKindDenials(toolCapabilities, context, agent.source);
  }

  const skillCapabilities = await buildSkillPreloadCapabilities(
    agent,
    snapshot,
    context,
  );

  const capabilities = sortCapabilities([
    buildPermissionCapability(agent, permissionResult),
    ...toolCapabilities,
    ...buildMcpServerCapabilities(snapshot),
    ...buildTrustCapabilities(agent, snapshot),
    ...buildInstructionCapabilities(snapshot, context),
    ...skillCapabilities,
  ]);

  const warnings = [
    ...buildIgnoredFieldWarnings(agent, permissionResult, pluginLimitations),
    ...(await resolveSecurityFindings({
      agent,
      snapshot,
      toolCapabilities,
    })),
  ];

  return {
    agentId,
    context,
    version: snapshot.version,
    capabilities,
    warnings,
    unknownRate: computeUnknownRate(capabilities),
  };
}
