/**
 * Platform-agnostic domain types.
 * Claude-specific types live in src/adapters/claude/.
 * @see docs/SPEC.md §5
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

export type PermissionMode =
  | "default"
  | "acceptEdits"
  | "auto"
  | "dontAsk"
  | "bypassPermissions"
  | "plan";

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
  builtinKind?: "explore" | "plan" | "general-purpose" | "claude";
  depth: number;
  maxDepth: number;
  parentPermissionMode?: PermissionMode;
}

export interface SourceInfo {
  platform: "claude";
  path?: string;
  scope: Scope;
  fieldPath?: string;
  matrixRef?: string;
}

export interface PlatformVersion {
  platform: "claude";
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

export interface AgentConfiguration {
  tools?: string[];
  disallowedTools?: string[];
  mcpServers?: Array<string | Record<string, unknown>>;
  model?: string;
  permissionMode?: PermissionMode;
  maxTurns?: number;
  skills?: string[];
  hooks?: unknown;
  memory?: "user" | "project" | "local";
  background?: boolean;
  effort?: string;
  isolation?: "worktree";
  initialPrompt?: string;
  color?: string;
  unknownFields: Record<string, unknown>;
}

export interface Agent {
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
  configuration: AgentConfiguration;
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
  accepted: boolean;
  projectPath: string;
}

export interface ProjectSnapshot {
  id: string;
  projectPath: string;
  version: PlatformVersion;
  environment: PlatformEnvironment;
  trust: TrustState;
  agents: Agent[];
  skills: unknown[];
  instructions: unknown[];
  mcpServers: unknown[];
  settings: unknown[];
  /** Snapshot-level warnings (e.g. description budget §7.7). */
  warnings: Warning[];
  scannedAt: string;
}
