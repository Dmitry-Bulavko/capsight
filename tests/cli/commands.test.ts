import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformVersion } from "../../src/core/model/index.js";
import type {
  ClaudeAgent as Agent,
  ClaudeProjectSnapshot as ProjectSnapshot,
} from "../../src/adapters/claude/model/index.js";
import type { ScanResult } from "../../src/application/scan.js";
import {
  buildStatusSummary,
  clearLastScan,
  getOrScan,
  scanAndStore,
  setLastScan,
} from "../../src/application/scan-store.js";
import {
  CONTEXT_PRESETS,
  DEFAULT_CONTEXT_PRESET,
  DEFAULT_CONTEXT_REASON,
  runAgents,
  runDiff,
  runExplain,
  runScan,
  runSimulateManaged,
  runStatus,
  runWarnings,
} from "../../src/cli/index.js";

vi.mock("../../src/application/scan.js", () => ({
  scan: vi.fn(),
}));

import { scan } from "../../src/application/scan.js";

const mockScan = vi.mocked(scan);

const mockVersion: PlatformVersion = {
  platform: "claude",
  // A version the matrix supports: below 2.1.0 every gated rule resolves
  // unsupported and the capability status degrades to unknown (§8.3, H1-17).
  version: "2.1.233",
  raw: "2.1.233 (mock)",
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
    platform: "claude",
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

  describe("runExplain", () => {
    const explainAgent: Agent = {
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
        tools: ["Read", "Write", "Grep", "Bash"],
        disallowedTools: ["Bash"],
        unknownFields: {},
      },
      isPluginAgent: false,
    };

    it("prints the §7.5 chain fields for a capability", async () => {
      setLastScan(makeScanResult({ agents: [explainAgent] }));

      const result = await runExplain("Bash", {
        agentId: "backend",
        context: "foreground-subagent",
      });

      expect(result.agentId).toBe("backend");
      expect(result.context.preset).toBe("foreground-subagent");
      expect(result.capability.capabilityId).toBe("Bash");
      expect(result.capability.status).toBe("denied");
      expect(result.capability.enforcement).toEqual(expect.any(String));
      expect(result.capability.sources.length).toBeGreaterThanOrEqual(1);
      // denied-by + chain both live in `reasons`, matching the API response.
      expect(result.capability.reasons.some((reason) => reason.type === "denied")).toBe(
        true,
      );
      expect(mockScan).not.toHaveBeenCalled();
    });

    it("reports the capability as unknown when no CLI version was detected (§8.3)", async () => {
      setLastScan(
        makeScanResult({
          agents: [explainAgent],
          version: {
            platform: "claude",
            version: "unknown",
            raw: "",
            detectedAt: "2026-01-01T00:00:00.000Z",
          },
        }),
      );

      const result = await runExplain("Bash", {
        agentId: "backend",
        context: "foreground-subagent",
      });

      // The deny is produced by a version-gated rule, so without a version
      // neither axis is a claim we can make (H1-17).
      expect(result.capability.status).toBe("unknown");
      expect(result.capability.enforcement).toBe("unknown");
      expect(result.capability.reasons.some((reason) => reason.matrixRef)).toBe(true);
    });

    it("defaults to background-subagent and reports why (§4.3)", async () => {
      setLastScan(makeScanResult({ agents: [explainAgent] }));

      const result = await runExplain("Read", { agentId: "backend" });

      expect(result.context.preset).toBe("background-subagent");
      expect(DEFAULT_CONTEXT_PRESET).toBe("background-subagent");
      expect(result.contextDefault).toEqual({
        preset: "background-subagent",
        reason: DEFAULT_CONTEXT_REASON,
      });
      expect(DEFAULT_CONTEXT_REASON).toMatch(/T6/);
    });

    it("omits the default caption when --context is given explicitly", async () => {
      setLastScan(makeScanResult({ agents: [explainAgent] }));

      const result = await runExplain("Read", {
        agentId: "backend",
        context: "background-subagent",
      });

      expect(result.contextDefault).toBeUndefined();
    });

    it("accepts every §4.3 preset", async () => {
      setLastScan(makeScanResult({ agents: [explainAgent] }));

      expect(CONTEXT_PRESETS).toEqual([
        "main-session",
        "foreground-subagent",
        "background-subagent",
        "fork",
        "explore",
        "plan",
        "teammate",
      ]);

      for (const preset of CONTEXT_PRESETS) {
        const result = await runExplain("Read", { agentId: "backend", context: preset });
        expect(result.context.preset).toBe(preset);
      }
    });

    it("rejects an unknown preset", async () => {
      setLastScan(makeScanResult({ agents: [explainAgent] }));

      await expect(
        runExplain("Read", { agentId: "backend", context: "not-a-preset" }),
      ).rejects.toThrow(/Invalid context preset/);
    });

    it("throws when the capability is not resolved", async () => {
      setLastScan(makeScanResult({ agents: [explainAgent] }));

      await expect(
        runExplain("nonexistent-tool", { agentId: "backend" }),
      ).rejects.toThrow("Capability not found: nonexistent-tool");
    });

    it("throws when the agent does not exist", async () => {
      setLastScan(makeScanResult({ agents: [explainAgent] }));

      await expect(runExplain("Read", { agentId: "missing" })).rejects.toThrow(
        "Agent not found: missing",
      );
    });

    it("applies depth and parentMode overrides", async () => {
      setLastScan(makeScanResult({ agents: [explainAgent] }));

      const result = await runExplain("Read", {
        agentId: "backend",
        context: "background-subagent",
        depth: 1,
        parentMode: "auto",
      });

      expect(result.context).toMatchObject({
        preset: "background-subagent",
        depth: 1,
        parentPermissionMode: "auto",
      });
    });

    it("does not mutate the stored snapshot", async () => {
      const stored = makeScanResult({ agents: [explainAgent] });
      const before = JSON.stringify(stored);
      setLastScan(stored);

      await runExplain("Read", { agentId: "backend" });

      expect(JSON.stringify(stored)).toBe(before);
    });
  });

  describe("runWarnings", () => {
    const warningAgent: Agent = {
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
        tools: ["Read", "Bash"],
        permissionMode: "bypassPermissions",
        unknownFields: {},
      },
      isPluginAgent: false,
    };

    it("lists warnings with category, severity, evidence and agentId", async () => {
      setLastScan(makeScanResult({ agents: [warningAgent] }));

      const result = await runWarnings();

      expect(result.warnings.length).toBeGreaterThan(0);
      for (const warning of result.warnings) {
        expect(warning).toMatchObject({
          agentId: "backend",
          category: expect.any(String),
          severity: expect.any(String),
          message: expect.any(String),
          evidence: expect.any(Array),
        });
      }
      expect(result.warnings.some((warning) => warning.matrixRef !== undefined)).toBe(
        true,
      );
    });

    it("defaults to background-subagent and reports why (§4.3)", async () => {
      setLastScan(makeScanResult({ agents: [warningAgent] }));

      const result = await runWarnings();

      expect(result.contextDefault).toEqual({
        preset: "background-subagent",
        reason: DEFAULT_CONTEXT_REASON,
      });
    });

    it("skips non-active agents", async () => {
      setLastScan(
        makeScanResult({
          agents: [
            warningAgent,
            {
              ...warningAgent,
              id: "invalid-agent",
              name: "invalid-agent",
              status: "invalid",
              invalidReason: "no-description",
            },
          ],
        }),
      );

      const result = await runWarnings();

      const agentIds = result.warnings.map((warning) => warning.agentId);
      expect(agentIds).not.toContain("invalid-agent");
    });

    it("rejects an unknown preset", async () => {
      setLastScan(makeScanResult({ agents: [warningAgent] }));

      await expect(runWarnings({ context: "not-a-preset" })).rejects.toThrow(
        /Invalid context preset/,
      );
    });

    it("rejects an unknown parentMode", async () => {
      setLastScan(makeScanResult({ agents: [warningAgent] }));

      await expect(runWarnings({ parentMode: "nope" })).rejects.toThrow(
        /Invalid parentMode/,
      );
    });

    it("scans cwd when no prior scan exists", async () => {
      mockScan.mockResolvedValue(makeScanResult({ agents: [warningAgent] }));

      await runWarnings();

      expect(mockScan).toHaveBeenCalledWith({ projectPath: process.cwd() });
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
