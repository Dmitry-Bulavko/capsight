import type { Agent, Scope, SourceInfo } from "../../../core/model/index.js";

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
  source: SourceInfo;
  configPath: string;
  transport: "stdio" | "http" | "sse" | "ws" | "unknown";
  status: "configured" | "unknown";
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
