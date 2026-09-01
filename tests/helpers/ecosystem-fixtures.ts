import type { ScanResult } from "../../src/application/scan.js";
import type { Agent, ProjectSnapshot } from "../../src/core/model/index.js";

export function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "backend",
    name: "backend",
    description: "Backend agent",
    source: {
      platform: "claude",
      scope: "project",
      path: "/repo/.claude/agents/backend.md",
    },
    status: "active",
    configuration: { unknownFields: {} },
    isPluginAgent: false,
    ...overrides,
  };
}

export function makeSnapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    id: "snapshot-1",
    projectPath: "/repo",
    version: {
      platform: "claude",
      version: "1.0.0",
      raw: "1.0.0",
      detectedAt: "2026-01-01T00:00:00.000Z",
    },
    environment: { relevant: [] },
    trust: { accepted: true, projectPath: "/repo" },
    agents: [],
    skills: [],
    instructions: [],
    mcpServers: [],
    settings: [],
    warnings: [],
    scannedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    platform: "claude",
    status: "complete",
    snapshot: makeSnapshot(),
    ...overrides,
  };
}

export function makePlatformScanResult(
  platform: ScanResult["platform"],
  snapshotOverrides: Partial<ProjectSnapshot> = {},
): ScanResult {
  return makeScanResult({
    platform,
    snapshot: makeSnapshot({
      ...snapshotOverrides,
      version: {
        platform,
        version: "1.0.0",
        raw: "1.0.0",
        detectedAt: "2026-01-01T00:00:00.000Z",
      },
    }),
  });
}
