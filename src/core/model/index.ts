/**
 * Platform-agnostic domain types.
 * Claude-specific types live in src/adapters/claude/model/.
 * @see docs/SPEC.md §5, §12.2
 */

export type Scope =
  | "managed"
  | "cli"
  | "project"
  | "user"
  | "plugin"
  | "local"
  | "nested-project"
  | "unknown";

export type ContextPreset =
  | "main-session"
  | "foreground-subagent"
  | "background-subagent"
  | "fork"
  | "explore"
  | "plan"
  | "teammate";

export interface ExecutionContext {
  preset: ContextPreset;
  isMainSession: boolean;
  isBackground: boolean;
  isFork: boolean;
  isTeammate: boolean;
  /** Platform-defined builtin agent kind, when the preset denotes one. */
  builtinKind?: string;
  depth: number;
  maxDepth: number;
  /** Platform-defined parent permission mode identifier. */
  parentPermissionMode?: string;
}

export interface SourceInfo {
  /** Platform adapter identifier that produced this source. */
  platform: string;
  path?: string;
  scope: Scope;
  fieldPath?: string;
  matrixRef?: string;
}

export interface PlatformVersion {
  platform: string;
  version: string;
  raw: string;
  detectedAt: string;
}

export interface PlatformEnvironment {
  relevant: Array<{
    key: string;
    origin: "process" | "settings.env" | "managed";
    effect: string;
    normalizedValue?: string;
  }>;
}

/** Value type of an unrecognized field; contents are never retained. */
export type UnknownFieldType =
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "array"
  | "object"
  | "unknown";

/**
 * Platform-neutral agent configuration. Field names of a platform's agent
 * definition live in that platform's adapter, which extends this type
 * (§12.2, §13 invariant 1).
 */
export interface AgentConfiguration {
  /** Unrecognized configuration keys mapped to value types (§8.2) — never values. */
  unknownFields: Record<string, UnknownFieldType>;
}

export interface Agent<
  TConfiguration extends AgentConfiguration = AgentConfiguration,
> {
  id: string;
  name: string;
  description: string;
  source: SourceInfo;
  status: "active" | "shadowed" | "ambiguous" | "invalid" | "unknown";
  collision?: {
    candidates: SourceInfo[];
    effective?: SourceInfo;
    rule: string;
  };
  invalidReason?: "no-name" | "no-description" | "bad-yaml" | "bad-name-chars";
  configuration: TConfiguration;
  isPluginAgent: boolean;
}

export interface ResolutionReason {
  type:
    | "declared"
    | "inherited"
    | "denied"
    | "shadowed"
    | "ambiguous"
    | "trust"
    | "parent-mode"
    | "depth-limit"
    | "context-filter"
    | "version"
    | "environment"
    | "plugin-limitation"
    | "not-probed"
    | "unknown";
  message: string;
  source?: SourceInfo;
  matrixRef?: string;
}

export interface ResolvedCapability {
  capabilityId: string;
  kind: "tool" | "mcp_server" | "mcp_tool" | "skill" | "instruction" | "permission";
  status: "available" | "denied" | "preloaded" | "blocked" | "unknown";
  enforcement: "enforced" | "advisory" | "unknown";
  sources: SourceInfo[];
  reasons: ResolutionReason[];
}

export interface Warning {
  category:
    | "trust"
    | "shadowing"
    | "ambiguous-collision"
    | "unsupported"
    | "ignored-field"
    | "advisory"
    | "unknown"
    | "security-finding"
    | "environment"
    | "version"
    | "budget"
    | "resolver-discrepancy";
  severity: "info" | "warning" | "critical";
  message: string;
  evidence: SourceInfo[];
  matrixRef?: string;
}

export interface EffectiveConfiguration {
  agentId: string;
  context: ExecutionContext;
  version: PlatformVersion;
  capabilities: ResolvedCapability[];
  warnings: Warning[];
  unknownRate: number;
}

export interface TrustState {
  /**
   * `true` / `false` when the platform trust record could be read; `"unknown"`
   * when trust itself could not be determined (unreadable or malformed record).
   */
  accepted: boolean | "unknown";
  projectPath: string;
  /** Why trust could not be determined. Set only when `accepted === "unknown"`. */
  unknownReason?: string;
}

export interface ProjectSnapshot<
  TConfiguration extends AgentConfiguration = AgentConfiguration,
> {
  id: string;
  projectPath: string;
  version: PlatformVersion;
  environment: PlatformEnvironment;
  trust: TrustState;
  agents: Array<Agent<TConfiguration>>;
  skills: unknown[];
  instructions: unknown[];
  mcpServers: unknown[];
  settings: unknown[];
  /** Snapshot-level warnings (e.g. description budget §7.7). */
  warnings: Warning[];
  scannedAt: string;
}
