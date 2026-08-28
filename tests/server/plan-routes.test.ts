import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { PlatformVersion } from "../../src/core/model/index.js";
import type {
  ClaudeAgent as Agent,
  ClaudeProjectSnapshot as ProjectSnapshot,
} from "../../src/adapters/claude/model/index.js";
import type { ScanResult } from "../../src/application/scan.js";
import { clearLastScan, setLastScan } from "../../src/application/scan-store.js";
import { app } from "../../src/server/index.js";

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
    unknownFields: {},
  },
  isPluginAgent: false,
};

function makeSnapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    id: "snapshot-plan",
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
    snapshot: makeSnapshot(overrides),
    status: "complete",
  };
}

describe("plan API routes", () => {
  beforeEach(() => {
    clearLastScan();
  });

  afterEach(() => {
    clearLastScan();
  });

  describe("POST /api/plan", () => {
    it("returns 404 when no scan is available", async () => {
      const response = await request(app)
        .post("/api/plan")
        .send({ pending: { byAgent: {} }, editSnapshotId: "snapshot-plan" });

      expect(response.status).toBe(404);
    });

    it("returns 400 when pending is missing", async () => {
      setLastScan(makeScanResult());

      const response = await request(app)
        .post("/api/plan")
        .send({ editSnapshotId: "snapshot-plan" });

      expect(response.status).toBe(400);
    });

    it("returns planned file changes", async () => {
      setLastScan(makeScanResult());

      const response = await request(app)
        .post("/api/plan")
        .send({
          pending: { byAgent: { [AGENT.id]: { Write: true } } },
          editSnapshotId: "snapshot-plan",
        });

      expect(response.status).toBe(200);
      expect(response.body.snapshotId).toBe("snapshot-plan");
      expect(response.body.files).toHaveLength(1);
      expect(response.body.files[0].path).toBe("/mock/project/.claude/agents/backend.md");
      expect(response.body.files[0].changes).toEqual([
        {
          field: "tools",
          before: ["Grep", "Read"],
          after: ["Grep", "Read", "Write"],
        },
      ]);
    });

    it("includes snapshot id warning when ids differ", async () => {
      setLastScan(makeScanResult());

      const response = await request(app)
        .post("/api/plan")
        .send({
          pending: { byAgent: { [AGENT.id]: { Write: true } } },
          editSnapshotId: "stale-id",
        });

      expect(response.status).toBe(200);
      expect(response.body.warnings).toEqual([
        expect.objectContaining({
          code: "snapshot-id-changed",
          editSnapshotId: "stale-id",
          currentSnapshotId: "snapshot-plan",
        }),
      ]);
    });
  });
});
