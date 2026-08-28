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
import { FACT, type FactId } from "../version/facts.js";
import {
  MATRIX,
  depthLimitMatrixId,
  gateCapability,
  isMatrixId,
  type MatrixId,
} from "../version/matrix.js";
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
  matrixRef?: FactId,
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
  version: string,
): ResolvedCapability[] {
  return parentPool.map((toolName) =>
    gateCapability(
      {
        capabilityId: toolName,
        kind: capabilityKind(toolName),
        status: "available" as const,
        enforcement: "unknown" as const,
        sources: [PARENT_SESSION_SOURCE],
        reasons: [forkReason],
      },
      MATRIX["context.fork"],
      version,
    ),
  );
}

/**
 * Matrix entry behind a context-filter removal. Filter 2 removals are the only
 * ones the core filter labels as background; depth-limit removals carry their
 * own reason type (N2/N5).
 */
function removalMatrixId(
  removal: ContextFilterRemoval,
  version: string,
): MatrixId {
  if (removal.reason.type === "depth-limit") {
    // Below 2.1.219 the N5 default depth is a recorded drift (§8.4).
    return depthLimitMatrixId(version);
  }
  return removal.reason.message.includes("filter 2")
    ? MATRIX["context.filter2"]
    : MATRIX["context.filter1"];
}

function applyFilterRemovals(
  capabilities: ResolvedCapability[],
  removals: readonly ContextFilterRemoval[],
  version: string,
): ResolvedCapability[] {
  const byId = new Map(capabilities.map((capability) => [capability.capabilityId, capability]));

  for (const removal of removals) {
    const matrixId = removalMatrixId(removal, version);
    const existing = byId.get(removal.tool);
    if (existing) {
      byId.set(
        removal.tool,
        gateCapability(
          {
            ...existing,
            status: "denied",
            enforcement: "enforced",
            reasons: [...existing.reasons, removal.reason],
          },
          matrixId,
          version,
        ),
      );
      continue;
    }

    byId.set(
      removal.tool,
      gateCapability(
        {
          capabilityId: removal.tool,
          kind: capabilityKind(removal.tool),
          status: "denied",
          enforcement: "enforced",
          sources: [PARENT_SESSION_SOURCE],
          reasons: [removal.reason],
        },
        matrixId,
        version,
      ),
    );
  }

  return [...byId.values()];
}

function applyBuiltinKindDenials(
  capabilities: ResolvedCapability[],
  context: ExecutionContext,
  agentSource: SourceInfo,
  version: string,
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
      FACT.B2,
    );

    if (existing) {
      byId.set(
        toolName,
        gateCapability(
          {
            ...existing,
            status: "denied",
            enforcement: "enforced",
            reasons: [...existing.reasons, reason],
          },
          MATRIX["builtin.readOnly"],
          version,
        ),
      );
      continue;
    }

    byId.set(
      toolName,
      gateCapability(
        {
          capabilityId: toolName,
          kind: "tool",
          status: "denied",
          enforcement: "enforced",
          sources: [agentSource],
          reasons: [reason],
        },
        MATRIX["builtin.readOnly"],
        version,
      ),
    );
  }

  return [...byId.values()];
}

/**
 * Matrix entry behind the effective permission mode: the rule that actually
 * fired (P1/P2/P4), the fork rule, or P5 when frontmatter/default applies.
 */
function permissionMatrixId(
  context: ExecutionContext,
  permissionResult: ReturnType<typeof resolvePermissionMode>,
): MatrixId {
  if (context.isFork) {
    return MATRIX["context.fork"];
  }
  const ref = permissionResult.reasons[0]?.matrixRef;
  return ref !== undefined && isMatrixId(ref) ? ref : MATRIX[FACT.P5];
}

function buildPermissionCapability(
  agent: Agent,
  context: ExecutionContext,
  permissionResult: ReturnType<typeof resolvePermissionMode>,
  version: string,
): ResolvedCapability {
  return gateCapability(
    {
      capabilityId: `permission:${permissionResult.effective}`,
      kind: "permission",
      status: "available",
      enforcement: "enforced",
      sources: [agent.source],
      reasons: permissionResult.reasons,
    },
    permissionMatrixId(context, permissionResult),
    version,
  );
}

function buildInstructionCapabilities(
  snapshot: ProjectSnapshot,
  context: ExecutionContext,
  version: string,
): ResolvedCapability[] {
  if (context.builtinKind === "explore" || context.builtinKind === "plan") {
    // §4.4 item 4: instructions resolve as zero sources with an I2 reason. The
    // capability carries no `sources` precisely because no instruction file is
    // loaded; there is no frontmatter field or setting that changes this (I2).
    return [
      gateCapability(
        {
          capabilityId: "instructions",
          kind: "instruction" as const,
          status: "denied" as const,
          enforcement: "enforced" as const,
          sources: [],
          reasons: [
            makeReason(
              "context-filter",
              "Explore and Plan built-in agents load no CLAUDE.md instruction sources (I2).",
              undefined,
              FACT.I2,
            ),
          ],
        },
        MATRIX["instructions.builtinKind"],
        version,
      ),
    ];
  }

  const instructions = snapshot.instructions as DiscoveredInstruction[];
  return instructions.map((instruction) =>
    gateCapability(
      {
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
            FACT.I1,
          ),
        ],
      },
      MATRIX["instructions.hierarchy"],
      version,
    ),
  );
}

function buildMcpServerCapabilities(
  snapshot: ProjectSnapshot,
  version: string,
): ResolvedCapability[] {
  const servers = snapshot.mcpServers as DiscoveredMcpServer[];

  return servers.map((server) => {
    const trustResult = resolveMcpConfigFileTrust(server.source);
    const outcome = trustOutcome(trustResult.status);
    return gateCapability(
      {
        capabilityId: `mcp-server:${server.id}`,
        kind: "mcp_server" as const,
        status: outcome.status,
        enforcement: outcome.enforcement,
        sources: [server.source],
        reasons: trustResult.reasons,
      },
      MATRIX["trust.inlineMcp"],
      version,
    );
  });
}

function buildTrustCapabilities(
  agent: Agent,
  snapshot: ProjectSnapshot,
  version: string,
): ResolvedCapability[] {
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
    capabilities.push(
      gateCapability(
        {
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
        },
        MATRIX["trust.inlineMcp"],
        version,
      ),
    );
  }

  if (agent.configuration.hooks !== undefined && agent.configuration.hooks !== null) {
    const trustResult = resolveTrustGate({
      agent,
      trust: snapshot.trust,
      kind: "agent-hooks",
    });

    const outcome = trustOutcome(trustResult.status);
    capabilities.push(
      gateCapability(
        {
          capabilityId: "agent-hooks",
          kind: "instruction",
          status: outcome.status,
          enforcement: outcome.enforcement,
          sources: [{ ...agent.source, fieldPath: "frontmatter.hooks" }],
          reasons: trustResult.reasons,
        },
        MATRIX["trust.frontmatterHooks"],
        version,
      ),
    );
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
      matrixRef: FACT.F9,
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
  // §8.3: with no `claude` CLI this is "unknown" and every version-sensitive
  // verdict below degrades to `enforcement: "unknown"`.
  const version = snapshot.version.version;

  let toolCapabilities: ResolvedCapability[];

  if (context.isFork) {
    const forkReason = makeReason(
      "context-filter",
      "Fork inherits parent session tool pool; agent configuration filters are not applied (T3).",
      agent.source,
      FACT.T3,
    );
    toolCapabilities = buildForkToolCapabilities(parentPool, forkReason, version);
  } else {
    const toolsResult = resolveAgentTools({
      parentPool,
      version,
      tools: agent.configuration.tools,
      disallowedTools: agent.configuration.disallowedTools,
      agentSource: agent.source,
    });
    const filterResult = applyContextFilters(toolsResult.pool, context);
    toolCapabilities = applyFilterRemovals(
      toolsResult.capabilities,
      filterResult.removals,
      version,
    );
    toolCapabilities = applyBuiltinKindDenials(
      toolCapabilities,
      context,
      agent.source,
      version,
    );
  }

  const skillCapabilities = await buildSkillPreloadCapabilities(
    agent,
    snapshot,
    context,
  );

  const capabilities = sortCapabilities([
    buildPermissionCapability(agent, context, permissionResult, version),
    ...toolCapabilities,
    ...buildMcpServerCapabilities(snapshot, version),
    ...buildTrustCapabilities(agent, snapshot, version),
    ...buildInstructionCapabilities(snapshot, context, version),
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
