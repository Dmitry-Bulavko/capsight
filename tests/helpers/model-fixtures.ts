import type {
  Agent,
  EffectiveConfiguration,
  ExecutionContext,
  PlatformVersion,
  ProjectSnapshot,
} from "../../src/core/model/index.js";
import { DEFAULT_CONTEXT_PRESET } from "../../src/core/model/context-presets.js";
import type { ScanResult } from "../../src/application/scan.js";

export const mockClaudeVersion: PlatformVersion = {
  platform: "claude",
  version: "2.1.0",
  raw: "2.1.0",
  detectedAt: "2026-01-01T00:00:00.000Z",
};

export const mockBackendAgent: Agent = {
  id: "agent-backend",
  name: "backend",
  description: "Backend agent",
  source: { platform: "claude", scope: "project", path: ".claude/agents/backend.md" },
  status: "active",
  configuration: { unknownFields: {} },
  isPluginAgent: false,
};

export function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    name: "backend",
    description: "Backend agent",
    source: { platform: "claude", scope: "project", path: ".claude/agents/backend.md" },
    status: "active",
    configuration: { unknownFields: {} },
    isPluginAgent: false,
    ...overrides,
  };
}

export function makeContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    preset: DEFAULT_CONTEXT_PRESET,
    isMainSession: false,
    isBackground: true,
    isFork: false,
    isTeammate: false,
    depth: 0,
    maxDepth: 3,
    ...overrides,
  };
}

export function makeEffective(overrides: Partial<EffectiveConfiguration> = {}): EffectiveConfiguration {
  return {
    agentId: "agent-1",
    context: makeContext(),
    version: mockClaudeVersion,
    capabilities: [],
    warnings: [],
    unknownRate: 0,
    ...overrides,
  };
}

export function makeSnapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    id: "abc123",
    projectPath: "/mock/project",
    version: mockClaudeVersion,
    environment: { relevant: [] },
    trust: { accepted: false, projectPath: "/mock/project" },
    agents: [mockBackendAgent],
    skills: [],
    instructions: [],
    mcpServers: [],
    settings: [],
    warnings: [],
    scannedAt: "2026-01-01T12:00:00.000Z",
    ...overrides,
  };
}

export function makeScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    platform: "claude",
    snapshot: makeSnapshot(),
    status: "complete",
    ...overrides,
  };
}
