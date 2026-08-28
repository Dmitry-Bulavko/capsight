import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { PlatformVersion } from "../../src/core/model/index.js";
import type {
  ClaudeAgent as Agent,
  ClaudeProjectSnapshot as ProjectSnapshot,
} from "../../src/adapters/claude/model/index.js";
import type { ScanResult } from "../../src/application/scan.js";
import { clearLastScan, setLastScan } from "../../src/application/scan-store.js";
import { app } from "../../src/server/index.js";

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
];

describe("project API routes", () => {
  beforeEach(() => {
    clearLastScan();
    mockScan.mockReset();
  });

  afterEach(() => {
    clearLastScan();
  });

  describe("GET /api/project", () => {
    it("returns 404 when no scan exists", async () => {
      const response = await request(app).get("/api/project");

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "No scan available" });
    });

    it("returns status summary from last scan", async () => {
      const result = makeScanResult({
        agents: mockAgents,
        skills: [{ id: "s1" }, { id: "s2" }],
      });
      setLastScan(result);

      const response = await request(app).get("/api/project");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        projectPath: "/mock/project",
        scannedAt: "2026-01-01T12:00:00.000Z",
        version: mockVersion,
        agents: {
          active: 1,
          invalid: 1,
          ambiguous: 0,
          shadowed: 0,
        },
        skillsCount: 2,
        instructionsCount: 0,
        mcpServersCount: 0,
      });
    });
  });

  describe("GET /api/agents", () => {
    it("returns 404 when no scan exists", async () => {
      const response = await request(app).get("/api/agents");

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "No scan available" });
    });

    it("returns agents from last scan", async () => {
      const result = makeScanResult({ agents: mockAgents });
      setLastScan(result);

      const response = await request(app).get("/api/agents");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ agents: mockAgents });
    });
  });

  describe("POST /api/project/scan", () => {
    it("scans project path from body and stores result", async () => {
      const result = makeScanResult({ agents: mockAgents });
      mockScan.mockResolvedValue(result);

      const response = await request(app)
        .post("/api/project/scan")
        .send({ projectPath: "/mock/project" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(result);
      expect(mockScan).toHaveBeenCalledWith({ projectPath: "/mock/project" });

      const projectResponse = await request(app).get("/api/project");
      expect(projectResponse.status).toBe(200);
      expect(projectResponse.body.agents.active).toBe(1);
    });

    it("defaults project path to cwd when body omits projectPath", async () => {
      const result = makeScanResult();
      mockScan.mockResolvedValue(result);

      const response = await request(app).post("/api/project/scan").send({});

      expect(response.status).toBe(200);
      expect(mockScan).toHaveBeenCalledWith({ projectPath: process.cwd() });
    });
  });
});
