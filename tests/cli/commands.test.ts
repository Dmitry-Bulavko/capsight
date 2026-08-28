import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent, PlatformVersion, ProjectSnapshot } from "../../src/core/model/index.js";
import type { ScanResult } from "../../src/application/scan.js";
import {
  buildStatusSummary,
  clearLastScan,
  getOrScan,
  scanAndStore,
  setLastScan,
} from "../../src/application/scan-store.js";
import { runAgents, runDiff, runScan, runSimulateManaged, runStatus } from "../../src/cli/index.js";

vi.mock("../../src/application/scan.js", () => ({
  scan: vi.fn(),
}));

import { scan } from "../../src/application/scan.js";

const mockScan = vi.mocked(scan);

const mockVersion: PlatformVersion = {
  platform: "claude",
  version: "1.0.0",
  raw: "1.0.0 (mock)",
  detectedAt: "2026-01-01T00:00:00.000Z",
};

function makeSnapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    id: "abc123",
    projectPath: "/mock/project",
    version: mockVersion,
    environment: { relevant: [] },
    trust: { accepted: false, projectPath: "/mock/project" },
    agents: [],
    skills: [],
    instructions: [],
    mcpServers: [],
    settings: [],
    warnings: [],
    scannedAt: "2026-01-01T12:00:00.000Z",
    ...overrides,
  };
}

function makeScanResult(overrides: Partial<ProjectSnapshot> = {}): ScanResult {
  return {
    snapshot: makeSnapshot(overrides),
    status: "complete",
  };
}

const mockAgents: Agent[] = [
  {
    id: "backend",
    name: "backend",
    description: "Backend agent",
    source: { platform: "claude", scope: "project", path: "/mock/project/.claude/agents/backend.md" },
    status: "active",
    configuration: { unknownFields: {} },
    isPluginAgent: false,
  },
  {
    id: "legacy",
    name: "legacy",
    description: "",
    source: { platform: "claude", scope: "project", path: "/mock/project/.claude/agents/legacy.md" },
    status: "invalid",
    invalidReason: "no-description",
    configuration: { unknownFields: {} },
    isPluginAgent: false,
  },
  {
    id: "dup-a",
    name: "dup",
    description: "First dup",
    source: { platform: "claude", scope: "project", path: "/mock/project/.claude/agents/dup-a.md" },
    status: "ambiguous",
    configuration: { unknownFields: {} },
    isPluginAgent: false,
  },
  {
    id: "dup-b",
    name: "dup",
    description: "Second dup",
    source: { platform: "claude", scope: "user", path: "/home/user/.claude/agents/dup-b.md" },
    status: "shadowed",
    configuration: { unknownFields: {} },
    isPluginAgent: false,
  },
];

describe("CLI commands", () => {
  beforeEach(() => {
    clearLastScan();
    mockScan.mockReset();
  });

  afterEach(() => {
    clearLastScan();
  });

  describe("runScan", () => {
    it("returns full ScanResult and stores it", async () => {
      const result = makeScanResult({ agents: mockAgents, skills: [{ id: "skill-1" }, { id: "skill-2" }] });
      mockScan.mockResolvedValue(result);

      const output = await runScan("/mock/project");

      expect(output).toEqual(result);
      expect(mockScan).toHaveBeenCalledWith({ projectPath: "/mock/project" });
      expect(await getOrScan()).toBe(result);
    });
  });

  describe("runStatus", () => {
    it("builds summary from stored scan", async () => {
      const result = makeScanResult({
        agents: mockAgents,
        skills: [{ id: "s1" }, { id: "s2" }, { id: "s3" }],
      });
      setLastScan(result);

      const summary = await runStatus();

      expect(summary).toEqual({
        projectPath: "/mock/project",
        scannedAt: "2026-01-01T12:00:00.000Z",
        version: mockVersion,
        agents: {
          active: 1,
          invalid: 1,
          ambiguous: 1,
          shadowed: 1,
        },
        skillsCount: 3,
        instructionsCount: 0,
        mcpServersCount: 0,
      });
      expect(mockScan).not.toHaveBeenCalled();
    });

    it("scans cwd when no prior scan exists", async () => {
      const result = makeScanResult({ agents: [], skills: [] });
      mockScan.mockResolvedValue(result);

      await runStatus();

      expect(mockScan).toHaveBeenCalledWith({ projectPath: process.cwd() });
    });
  });

  describe("runAgents", () => {
    it("returns agents array from stored scan", async () => {
      const result = makeScanResult({ agents: mockAgents });
      setLastScan(result);

      const agents = await runAgents();

      expect(agents).toEqual(mockAgents);
      expect(mockScan).not.toHaveBeenCalled();
    });

    it("scans cwd when no prior scan exists", async () => {
      const result = makeScanResult({ agents: mockAgents });
      mockScan.mockResolvedValue(result);

      const agents = await runAgents();

      expect(agents).toEqual(mockAgents);
      expect(mockScan).toHaveBeenCalledWith({ projectPath: process.cwd() });
    });
  });

  describe("buildStatusSummary", () => {
    it("counts only active, invalid, ambiguous, and shadowed agents", () => {
      const result = makeScanResult({
        agents: [
          ...mockAgents,
          {
            id: "unknown-agent",
            name: "unknown-agent",
            description: "Unknown status",
            source: { platform: "claude", scope: "unknown" },
            status: "unknown",
            configuration: { unknownFields: {} },
            isPluginAgent: false,
          },
        ],
      });

      const summary = buildStatusSummary(result);

      expect(summary.agents).toEqual({
        active: 1,
        invalid: 1,
        ambiguous: 1,
        shadowed: 1,
      });
    });
  });

  describe("scanAndStore", () => {
    it("persists scan result for subsequent commands", async () => {
      const result = makeScanResult();
      mockScan.mockResolvedValue(result);

      await scanAndStore("/other/path");
      const cached = await getOrScan();

      expect(cached).toBe(result);
      expect(mockScan).toHaveBeenCalledTimes(1);
    });
  });

  describe("runSimulateManaged", () => {
    it("delegates to simulateManagedOverlay with stored scan", async () => {
      const bundlePath = "/policy/candidate";
      const result = makeScanResult({
        agents: [
          {
            id: "backend",
            name: "backend",
            description: "Backend agent",
            source: {
              platform: "claude",
              scope: "project",
              path: "/mock/project/.claude/agents/backend.md",
            },
            status: "active",
            configuration: { unknownFields: {} },
            isPluginAgent: false,
          },
        ],
      });
      setLastScan(result);

      const simulateModule = await import("../../src/application/simulate.js");
      const simulateSpy = vi
        .spyOn(simulateModule, "simulateManagedOverlay")
        .mockResolvedValue({
          snapshotId: result.snapshot.id,
          bundlePath,
          context: {
            preset: "main-session",
            isMainSession: true,
            isBackground: false,
            isFork: false,
            isTeammate: false,
            depth: 0,
            maxDepth: 3,
          },
          delta: {
            shadowedAgents: [],
            deniedTools: [],
            modelChanges: [],
            ignoredFields: [],
          },
        });

      const output = await runSimulateManaged(bundlePath);

      expect(simulateSpy).toHaveBeenCalledWith({
        managedBundlePath: bundlePath,
        projectPath: undefined,
      });
      expect(output.snapshotId).toBe(result.snapshot.id);
      simulateSpy.mockRestore();
    });
  });

  describe("runDiff", () => {
    it("returns planned changes from pending editor state", async () => {
      const agent: Agent = {
        id: "backend",
        name: "backend",
        description: "Backend agent",
        source: {
          platform: "claude",
          scope: "project",
          path: "/mock/project/.claude/agents/backend.md",
        },
        status: "active",
        configuration: {
          tools: ["Read", "Grep"],
          unknownFields: {},
        },
        isPluginAgent: false,
      };
      const result = makeScanResult({ agents: [agent] });
      setLastScan(result);

      const output = await runDiff({
        pending: { byAgent: { [agent.id]: { Write: true } } },
        editSnapshotId: result.snapshot.id,
      });

      expect(output.snapshotId).toBe(result.snapshot.id);
      expect(output.files).toHaveLength(1);
      expect(output.files[0]?.changes[0]).toEqual({
        field: "tools",
        before: ["Grep", "Read"],
        after: ["Grep", "Read", "Write"],
      });
    });
  });
});
