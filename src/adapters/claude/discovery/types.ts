import type {
  Enforcement,
  Scope,
  SourceInfo,
} from "../../../core/model/index.js";
import type { ClaudeAgent as Agent } from "../model/index.js";

export interface DiscoveredSkill {
  id: string;
  name: string;
  description?: string;
  source: SourceInfo;
  path: string;
  /**
   * Confidence that the platform actually attaches this skill (§6). Set only
   * for skills a version-sensitive discovery rule attached (K12); absent for
   * skills found on the ordinary scope walk, which no matrix entry gates.
   */
  enforcement?: Enforcement;
}

export interface DiscoveredInstruction {
  id: string;
  type: "CLAUDE.md" | "CLAUDE.local.md" | "managed" | "imported" | "other";
  path: string;
  scope: Scope;
  sizeBytes: number;
}

export interface DiscoveredMcpServer {
  id: string;
  /** Server key as written in the config (`mcpServers.<name>`). */
  name: string;
  source: SourceInfo;
  configPath: string;
  transport: "stdio" | "http" | "sse" | "ws" | "unknown";
  definitionKind: "inline-agent" | "named-reference" | "config-file";
  status:
    | "configured"
    | "probed"
    | "unavailable"
    | "requires_auth"
    | "blocked_by_trust"
    | "unknown";
  /** Key-names-only hash of the server config — never contains values (§7.9). */
  configHash: string;
}

/** `permissions.<action>` list a rule was written in (§3.5). */
export type SettingsPermissionAction = "allow" | "deny" | "ask";

/**
 * One entry of a `permissions.allow` / `deny` / `ask` array, kept verbatim.
 * Discovery does not interpret the rule text — S3–S8 semantics belong to
 * resolution — it only records what the layer says and where it says it.
 */
export interface SettingsPermissionRule {
  action: SettingsPermissionAction;
  /** Position in its `permissions.<action>` array; the rule's `fieldPath`. */
  index: number;
  /** Rule text exactly as written in the settings file. */
  raw: string;
}

export interface SettingsPermissions {
  rules: SettingsPermissionRule[];
  /** Present only when the layer sets the key; absent is not `false` (P4, S1). */
  disableBypassPermissionsMode?: boolean;
}

export interface SettingsLayer {
  scope: Scope;
  path: string;
  /** Layer rank for S1 precedence: higher wins. */
  priority: number;
  /** Parsed `permissions` block; absent when the layer declares none. */
  permissions?: SettingsPermissions;
}

export interface RawAgentFile {
  filePath: string;
  scope: Scope;
  agentsRoot: string;
  scopeDistance: number;
  scopePriority: number;
  isPluginAgent: boolean;
  /**
   * Name of the plugin that ships this file, the first segment of its A6
   * scoped id. Set only for plugin sources.
   */
  pluginName?: string;
  /**
   * Matrix entry backing the rule that attached this directory (A9). Absent
   * for the ordinary project/user scope walk, which no entry gates.
   */
  matrixRef?: string;
}

export interface AgentDiscoveryResult {
  agents: Agent[];
  invalidCount: number;
}
