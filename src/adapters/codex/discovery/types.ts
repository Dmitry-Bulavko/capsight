import type { Enforcement, Scope, SourceInfo } from "../../../core/model/index.js";

export interface DiscoveredSkill {
  id: string;
  name: string;
  description?: string;
  source: SourceInfo;
  path: string;
  kind: "skill";
  enforcement?: Enforcement;
}

export interface DiscoveredInstruction {
  id: string;
  type: "AGENTS.md" | "AGENTS.override.md" | "fallback";
  path: string;
  scope: Scope;
  sizeBytes: number;
  description?: string;
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

export interface ParsedConfigLayer {
  scope: Scope;
  path: string;
  priority: number;
  parsed: Record<string, unknown>;
}
