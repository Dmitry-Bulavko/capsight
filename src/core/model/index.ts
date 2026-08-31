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
  | "builtin"
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

/**
 * Confidence axis every product claim carries (§6). `unknown` is not a weaker
 * claim but the absence of one: the platform behaviour behind it is not founded
 * on the detected version.
 */
export type Enforcement = "enforced" | "advisory" | "unknown";

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
    /**
     * The candidate that loads. Absent whenever the collision rule does not
     * name a winner (A4) or the matrix does not found the winner rule on the
     * detected version — a winner is never guessed (§8.2, §8.4).
     */
    effective?: SourceInfo;
    rule: string;
    /**
     * Matrix entry the rule was gated on. Optional in the core model because
     * an adapter may have none; the Claude adapter gates every collision rule
     * it emits (A1, A3, A4), so both fields are always present there.
     */
    matrixRef?: string;
    /** Confidence in this record (§6). */
    enforcement?: Enforcement;
  };
  invalidReason?: "no-name" | "no-description" | "bad-yaml" | "bad-name-chars";
  configuration: TConfiguration;
  isPluginAgent: boolean;
  /**
   * Scoped id a plugin agent is addressed by, subfolder included:
   * `my-plugin:review:security` (A6). Absent for non-plugin agents, whose
   * identity is the `name` alone (A5).
   */
  pluginScopedId?: string;
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
  enforcement: Enforcement;
  sources: SourceInfo[];
  reasons: ResolutionReason[];
}

/** Structured §7.4 ignored-field claim — UI must not parse `message` for these. */
export interface IgnoredFieldDetail {
  field: string;
  declared: string;
  /** Absent when the field is fully ignored (F9 plugin fields). */
  effective?: string;
  factRef?: string;
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
  /**
   * Confidence in the platform claim the warning makes (§6). Set by
   * `gateWarning`; `unknown` means the backing matrix entry is missing or not
   * supported on the detected version, so the warning is undetermined rather
   * than asserted, and its message carries the reason.
   *
   * Absent on findings that make no platform claim — a §7.9 security finding
   * reports configuration we read directly, not behaviour the platform
   * guarantees, so there is no version-sensitive claim to gate.
   */
  enforcement?: Enforcement;
  /** Present on `ignored-field` warnings from the resolver (§7.4). */
  ignoredField?: IgnoredFieldDetail;
  /** Capability rows this warning applies to; set by the resolver when the link is known. */
  relatedCapabilityIds?: string[];
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
  /**
   * Repository root the scan anchored on. Agent trust folders resolve relative
   * to this path when agent source paths are repo-relative.
   */
  repoRoot?: string;
  /**
   * Trust for folders that own project-scoped agents but are not the scan root
   * (R2 nested folders, R6 `--add-dir` paths). Keys are absolute paths;
   * a missing key is an honest `false`.
   */
  folderRecords?: Readonly<Record<string, boolean | "unknown">>;
}

export type {
  EcosystemInventory,
  InventoryResource,
  InventoryResourceKind,
  OverlapCollision,
  OverlapRelation,
  PlatformDetection,
  PlatformDetectionStatus,
} from "./ecosystem.js";
export { isMarkdownContentKind } from "./ecosystem.js";

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
