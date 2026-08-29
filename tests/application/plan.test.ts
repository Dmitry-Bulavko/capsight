import { beforeEach, describe, expect, it } from "vitest";
import type { PlatformVersion } from "../../src/core/model/index.js";
import type {
  ClaudeAgent as Agent,
  ClaudeProjectSnapshot as ProjectSnapshot,
} from "../../src/adapters/claude/model/index.js";
import { plan } from "../../src/application/plan.js";
import { clearLastScan, setLastScan } from "../../src/application/scan-store.js";
import type { ScanResult } from "../../src/application/scan.js";

const mockVersion: PlatformVersion = {
  platform: "claude",
  version: "2.1.0",
  raw: "2.1.0",
  detectedAt: "2026-01-01T00:00:00.000Z",
};

const AGENT: Agent = {
  id: "agent-backend",
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
    disallowedTools: ["Bash"],
    unknownFields: {},
  },
  isPluginAgent: false,
};

function makeSnapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    id: "snapshot-abc",
    projectPath: "/mock/project",
    version: mockVersion,
    environment: { relevant: [] },
    trust: { accepted: false, projectPath: "/mock/project" },
    agents: [AGENT],
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

describe("plan()", () => {
  beforeEach(() => {
    clearLastScan();
  });

  it("returns exact file and field changes without writing", async () => {
    setLastScan(makeScanResult());

    const result = await plan({
      pending: {
        byAgent: {
          [AGENT.id]: { Write: true, Read: false },
        },
      },
      editSnapshotId: "snapshot-abc",
    });

    expect(result.files).toEqual([
      {
        path: "/mock/project/.claude/agents/backend.md",
        agentId: AGENT.id,
        agentName: "backend",
        changes: [
          {
            field: "tools",
            before: ["Grep", "Read"],
            after: ["Grep", "Write"],
          },
        ],
      },
    ]);
    expect(result.warnings).toEqual([]);
    expect(result.snapshotId).toBe("snapshot-abc");
  });

  it("warns when snapshot id changed since editing started", async () => {
    setLastScan(makeScanResult({ id: "snapshot-new" }));

    const result = await plan({
      pending: { byAgent: { [AGENT.id]: { Write: true } } },
      editSnapshotId: "snapshot-old",
    });

    expect(result.warnings).toEqual([
      {
        code: "snapshot-id-changed",
        message:
          "Project configuration changed since editing started. Review the diff before applying.",
        editSnapshotId: "snapshot-old",
        currentSnapshotId: "snapshot-new",
      },
    ]);
  });

  it("returns empty files when pending is empty", async () => {
    setLastScan(makeScanResult());

    const result = await plan({
      pending: { byAgent: {} },
      editSnapshotId: "snapshot-abc",
    });

    expect(result.files).toEqual([]);
  });
});
