import type {
  EffectiveConfiguration,
  ExecutionContext,
  ResolutionReason,
  ResolvedCapability,
  SourceInfo,
  Warning,
} from "../../../core/model/index.js";
import type {
  ClaudeAgent as Agent,
  ClaudeProjectSnapshot as ProjectSnapshot,
} from "../model/index.js";
import { FACT, type FactId } from "../version/facts.js";
import {
  MATRIX,
  depthLimitMatrixId,
  gateCapability,
  gateWarning,
  isMatrixId,
  type MatrixId,
} from "../version/matrix.js";
import {
  applyContextFilters,
  type ContextFilterRemoval,
} from "../../../core/resolver/index.js";
import {
  AGENT_TOOL_NAMES,
  BACKGROUND_ALLOWED_BUILTIN_TOOLS,
  CLAUDE_TOOL_TABLES,
  FILTER_1_REMOVED_TOOLS,
  isMcpTool,
} from "./tool-tables.js";
import type { DiscoveredInstruction, DiscoveredMcpServer, SettingsLayer } from "../discovery/types.js";
import {
  resolvePermissionMode,
  type PermissionSettings,
} from "./permissions.js";
import { resolvePluginFieldLimitations } from "./plugin.js";
import {
  resolveDisableBypassPermissionsMode,
  resolveSettingsPermissions,
} from "./settings-permissions.js";
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

/**
 * Parent pool the agent's filters are applied to. Several agents are passed
 * for an A4 collision: the pool is the union over every candidate, so the set
 * of enumerated tools does not depend on which candidate we happened to read.
 */
function buildParentToolPool(agents: readonly Agent[]): string[] {
  const pool = new Set<string>(BUILTIN_PARENT_POOL);
  for (const pattern of agents.flatMap((agent) => [
    ...(agent.configuration.tools ?? []),
    ...(agent.configuration.disallowedTools ?? []),
  ])) {
    if (!pattern.includes("*") && !pattern.includes("(")) {
      pool.add(pattern);
    }
  }
  return BUILTIN_PARENT_POOL.concat(
    [...pool].filter((tool) => !BUILTIN_PARENT_POOL.includes(tool)).sort(),
  );
}

/**
 * Effective permission settings for the resolver. `disableBypassPermissionsMode`
 * comes from the highest-priority layer that sets it (S1) — a lower layer
 * setting it to `false` neither lifts nor confirms a `true` above it.
 */
function readPermissionSettings(settingsLayers: unknown[]): PermissionSettings {
  const resolved = resolveDisableBypassPermissionsMode(
    settingsLayers as SettingsLayer[],
  );
  return {
    ...(resolved.value !== undefined
      ? { disableBypassPermissionsMode: resolved.value }
      : {}),
    ...(resolved.source ? { disableBypassPermissionsModeSource: resolved.source } : {}),
    layerPrecedenceDecided: resolved.contested,
  };
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
  settings: PermissionSettings,
  version: string,
): ResolvedCapability {
  const capability = gateCapability(
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

  // When the layers disagree, the verdict rests on the S1 order as well as on
  // the rule that fired, so it is gated on both entries.
  return settings.layerPrecedenceDecided === true &&
    permissionResult.reasons[0]?.matrixRef === FACT.P4
    ? gateCapability(capability, MATRIX["settings.layerPrecedence"], version)
    : capability;
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
  version: string,
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
    warnings.push(
      gateWarning(
        {
          category: "ignored-field",
          severity: "warning",
          message:
            limitation.reasons[0]?.message ??
            `Plugin agents ignore frontmatter ${limitation.field} (F9).`,
          evidence: [
            { ...agent.source, fieldPath: `frontmatter.${limitation.field}` },
          ],
        },
        MATRIX["agent.pluginFieldLimits"],
        version,
      ),
    );
  }

  return warnings;
}

/**
 * Frontmatter fields a capability's verdict is derived from. Capabilities that
 * come from the project rather than from the agent file (discovered MCP
 * servers, instruction sources) derive from no field and are listed as such —
 * a name collision between two agent files cannot change them.
 */
function agentDerivedFields(capability: ResolvedCapability): readonly string[] {
  switch (capability.kind) {
    case "tool":
    case "mcp_tool":
      return ["tools", "disallowedTools"];
    case "permission":
      // A settings rule is declared in a settings file, not in the agent file,
      // so a name collision between two agent files cannot change it.
      return capability.capabilityId.startsWith("settings-permission:")
        ? []
        : ["permissionMode"];
    case "skill":
      return ["skills"];
    case "mcp_server":
      return capability.capabilityId.startsWith("inline-mcp:")
        ? ["mcpServers"]
        : [];
    case "instruction":
      return capability.capabilityId === "agent-hooks" ? ["hooks"] : [];
  }
}

/**
 * The candidates behind an `ambiguous` agent and the frontmatter fields they
 * disagree on. Discovery refuses to name a winner (A4, or a winner rule the
 * matrix does not found on this version), so resolution may only state what
 * every candidate states: a field they agree on has one value whichever file
 * loads, a field they disagree on has no determinable value at all.
 * @see docs/SPEC.md A4, §13 invariants 3, 4
 */
interface AgentAmbiguity {
  candidates: Agent[];
  candidateSources: SourceInfo[];
  contested: ReadonlySet<string>;
  rule: string;
  matrixRef?: string;
}

function configurationField(agent: Agent, field: string): unknown {
  return (agent.configuration as unknown as Record<string, unknown>)[field];
}

function analyzeAmbiguity(
  snapshot: ProjectSnapshot,
  agent: Agent,
): AgentAmbiguity | undefined {
  if (agent.status !== "ambiguous" || !agent.collision) {
    return undefined;
  }

  const candidateSources = agent.collision.candidates;
  const paths = new Set(
    candidateSources
      .map((source) => source.path)
      .filter((value): value is string => value !== undefined),
  );
  const candidates = snapshot.agents.filter(
    (entry) => entry.source.path !== undefined && paths.has(entry.source.path),
  );

  const fields = new Set(
    candidates.flatMap((candidate) => Object.keys(candidate.configuration)),
  );
  const contested = new Set<string>();
  for (const field of fields) {
    const first = JSON.stringify(
      configurationField(candidates[0]!, field) ?? null,
    );
    if (
      candidates.some(
        (candidate) =>
          JSON.stringify(configurationField(candidate, field) ?? null) !== first,
      )
    ) {
      contested.add(field);
    }
  }

  return {
    candidates,
    candidateSources,
    contested,
    rule: agent.collision.rule,
    ...(agent.collision.matrixRef ? { matrixRef: agent.collision.matrixRef } : {}),
  };
}

/**
 * Candidate files that are not already cited by this capability. Paths belong
 * in `sources`/`evidence`, never in message text, so both colliding files stay
 * visible without the message depending on where the project happens to live.
 */
function missingCandidateSources(
  capability: ResolvedCapability,
  candidateSources: readonly SourceInfo[],
): SourceInfo[] {
  const cited = new Set(
    capability.sources
      .map((source) => source.path)
      .filter((value): value is string => value !== undefined),
  );
  return candidateSources.filter(
    (source) => source.path !== undefined && !cited.has(source.path),
  );
}

/**
 * Apply an unresolved name collision to one capability. A contested field
 * leaves the capability undetermined on both axes — presenting one candidate's
 * `tools` as the effective set would be a confident wrong answer. Agreement is
 * recorded as an ordinary reason and does not downgrade anything: it is not a
 * version-sensitive claim, so it is deliberately not run through the matrix
 * gate, whose A4 entry is `unknown` by construction.
 */
function applyAmbiguity(
  capability: ResolvedCapability,
  ambiguity: AgentAmbiguity,
  agentName: string,
): ResolvedCapability {
  const fields = agentDerivedFields(capability);
  if (fields.length === 0) {
    return capability;
  }

  const contested = fields.filter((field) => ambiguity.contested.has(field));
  const count = ambiguity.candidates.length;

  if (contested.length === 0) {
    return {
      ...capability,
      reasons: [
        ...capability.reasons,
        {
          type: "declared",
          message:
            `All ${count} colliding declarations of agent "${agentName}" ` +
            `declare the same ${fields.join(" and ")}, so this capability holds ` +
            `whichever candidate the platform loads (${ambiguity.rule}).`,
          matrixRef: ambiguity.rule,
        },
      ],
    };
  }

  return {
    ...capability,
    // The mode itself is contested, so naming one candidate's mode in the id
    // would smuggle a winner back in through the capability identity.
    capabilityId:
      capability.kind === "permission" ? "permission:unknown" : capability.capabilityId,
    status: "unknown",
    enforcement: "unknown",
    sources: [
      ...capability.sources,
      ...missingCandidateSources(capability, ambiguity.candidateSources),
    ],
    reasons: [
      ...capability.reasons,
      {
        type: "ambiguous",
        message:
          `Agent "${agentName}" is declared in ${count} colliding files that disagree on ` +
          `${contested.join(" and ")}, and no candidate is effective (${ambiguity.rule}); ` +
          "this capability is unknown. See sources for the candidate files.",
        matrixRef: ambiguity.rule,
      },
    ],
  };
}

function buildAmbiguousCollisionWarning(
  agentName: string,
  ambiguity: AgentAmbiguity,
  version: string,
): Warning {
  const contested = [...ambiguity.contested].sort();
  const warning: Warning = {
    category: "ambiguous-collision",
    severity: "warning",
    message:
      `Agent "${agentName}" is declared in ${ambiguity.candidates.length} colliding files ` +
      `(see evidence) and no candidate is effective (${ambiguity.rule}). ` +
      (contested.length > 0
        ? `The candidates disagree on ${contested.join(", ")}; capabilities derived from those fields resolve unknown.`
        : "The candidates declare identical configuration, so capabilities are unaffected."),
    evidence: ambiguity.candidateSources,
  };

  return ambiguity.matrixRef
    ? gateWarning(warning, ambiguity.matrixRef, version)
    : warning;
}

/** The winner an A1/A3 collision names for a `shadowed` agent (§3 A3). */
interface AgentShadowing {
  winner: Agent;
  effective: SourceInfo;
  rule: string;
}

function analyzeShadowing(
  snapshot: ProjectSnapshot,
  agent: Agent,
): AgentShadowing | undefined {
  const effective = agent.collision?.effective;
  if (agent.status !== "shadowed" || !effective?.path) {
    return undefined;
  }
  const winner = snapshot.agents.find(
    (entry) => entry.source.path === effective.path,
  );
  return winner
    ? { winner, effective, rule: agent.collision!.rule }
    : undefined;
}

function applyShadowing(
  capability: ResolvedCapability,
  shadowing: AgentShadowing,
  agentName: string,
): ResolvedCapability {
  if (agentDerivedFields(capability).length === 0) {
    return capability;
  }
  return {
    ...capability,
    reasons: [
      ...capability.reasons,
      {
        type: "shadowed",
        message:
          `This declaration of agent "${agentName}" is shadowed (${shadowing.rule}); the ` +
          "capability is resolved from the effective declaration named by this reason's source.",
        source: shadowing.effective,
        matrixRef: shadowing.rule,
      },
    ],
  };
}

function buildShadowedWarning(
  agentName: string,
  agentSource: SourceInfo,
  shadowing: AgentShadowing,
): Warning {
  return {
    category: "shadowing",
    severity: "info",
    message:
      `Agent "${agentName}" is shadowed by another declaration of the same name ` +
      `(${shadowing.rule}); the effective declaration was resolved instead. Evidence lists ` +
      "the shadowed file first and the effective file second.",
    evidence: [agentSource, shadowing.effective],
  };
}

/**
 * An agent file the platform does not load (A7) has no effective
 * configuration: reporting the empty frontmatter of an unparsed file as an
 * inherited tool pool would be the §0.1.2 failure mode. Nothing is known, so
 * nothing is claimed and the unknown rate is total.
 */
function resolveInvalidAgent(
  snapshot: ProjectSnapshot,
  agent: Agent,
  agentId: string,
  context: ExecutionContext,
): EffectiveConfiguration {
  return {
    agentId,
    context,
    version: snapshot.version,
    capabilities: [],
    warnings: [
      {
        category: "unknown",
        severity: "warning",
        message:
          `Agent file is invalid (${agent.invalidReason ?? "unknown"}) and is not loaded by ` +
          "Claude Code (A7); no effective configuration can be resolved for it.",
        evidence: [agent.source],
      },
    ],
    unknownRate: 1,
  };
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
  const requested = snapshot.agents.find((entry) => entry.id === agentId);
  if (!requested) {
    throw new AgentNotFoundError(agentId);
  }

  if (requested.status === "invalid") {
    return resolveInvalidAgent(snapshot, requested, agentId, context);
  }

  // A3 does name a winner, so a shadowed declaration resolves through it
  // rather than through its own (unloaded) frontmatter.
  const shadowing = analyzeShadowing(snapshot, requested);
  const ambiguity = analyzeAmbiguity(snapshot, requested);
  const agent = shadowing?.winner ?? requested;

  const permissionSettings = readPermissionSettings(snapshot.settings);
  const permissionResult = resolvePermissionMode(
    agentForPermissionResolution(agent),
    context,
    permissionSettings,
  );
  const pluginLimitations = resolvePluginFieldLimitations(
    agent,
    snapshot.version.version,
  );
  const parentPool = buildParentToolPool(ambiguity?.candidates ?? [agent]);
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
    const filterResult = applyContextFilters(toolsResult.pool, context, CLAUDE_TOOL_TABLES);
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

  // §4.4 rule 7: settings permission rules are applied last, after the context
  // filters and after every agent-level filter, and in every context — a fork
  // skips the agent's own configuration (T3) but not a settings deny (S2).
  // Skills go through the same stage because S10 denies them by name too.
  const settingsPermissions = resolveSettingsPermissions({
    layers: snapshot.settings as SettingsLayer[],
    capabilities: [...toolCapabilities, ...skillCapabilities],
    version,
  });
  toolCapabilities = settingsPermissions.capabilities.filter(
    (capability) => capability.kind === "tool" || capability.kind === "mcp_tool",
  );

  const resolved = [
    buildPermissionCapability(
      agent,
      context,
      permissionResult,
      permissionSettings,
      version,
    ),
    ...settingsPermissions.capabilities,
    ...settingsPermissions.ruleCapabilities,
    ...buildMcpServerCapabilities(snapshot, version),
    ...buildTrustCapabilities(agent, snapshot, version),
    ...buildInstructionCapabilities(snapshot, context, version),
  ];

  const capabilities = sortCapabilities(
    ambiguity
      ? resolved.map((capability) =>
          applyAmbiguity(capability, ambiguity, requested.name),
        )
      : shadowing
        ? resolved.map((capability) =>
            applyShadowing(capability, shadowing, requested.name),
          )
        : resolved,
  );

  const warnings = [
    ...(ambiguity
      ? [buildAmbiguousCollisionWarning(requested.name, ambiguity, version)]
      : []),
    ...(shadowing
      ? [buildShadowedWarning(requested.name, requested.source, shadowing)]
      : []),
    ...buildIgnoredFieldWarnings(agent, permissionResult, pluginLimitations, version),
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
