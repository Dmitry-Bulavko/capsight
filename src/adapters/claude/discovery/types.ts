import type {
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

export interface SettingsLayer {
  scope: Scope;
  path: string;
  priority: number;
}

export interface RawAgentFile {
  filePath: string;
  scope: Scope;
  agentsRoot: string;
  scopeDistance: number;
  scopePriority: number;
  isPluginAgent: boolean;
}

export interface AgentDiscoveryResult {
  agents: Agent[];
  invalidCount: number;
}
