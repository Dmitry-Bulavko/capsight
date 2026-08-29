import type { Enforcement, Scope, SourceInfo } from "../../../core/model/index.js";
import type { CursorAgent as Agent } from "../model/index.js";

export interface DiscoveredSkill {
  id: string;
  name: string;
  description?: string;
  source: SourceInfo;
  path: string;
  kind: "skill" | "command";
  enforcement?: Enforcement;
}

export interface DiscoveredInstruction {
  id: string;
  type: "rule" | "AGENTS.md" | "cursorrules";
  path: string;
  scope: Scope;
  sizeBytes: number;
  description?: string;
  alwaysApply?: boolean;
  globs?: string[];
}

export interface DiscoveredMcpServer {
  id: string;
  name: string;
  source: SourceInfo;
  configPath: string;
  transport: "stdio" | "http" | "sse" | "ws" | "unknown";
  definitionKind: "config-file";
  status: "configured" | "unknown";
  configHash: string;
  envKeys?: string[];
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
}

export interface AgentDiscoveryResult {
  agents: Agent[];
  invalidCount: number;
}
