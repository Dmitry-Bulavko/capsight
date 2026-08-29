import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { PlatformVersion } from "../../src/core/model/index.js";
import type {
  ClaudeAgent as Agent,
  ClaudeProjectSnapshot as ProjectSnapshot,
} from "../../src/adapters/claude/model/index.js";
import type { ScanResult } from "../../src/application/scan.js";
import { getDefaultProjectPath } from "../../src/application/default-project-path.js";
import { clearLastScan, setLastScan } from "../../src/application/scan-store.js";
import { app } from "../../src/server/index.js";
import { resetBrowseInFlightForTests, pickNativeFolder } from "../../src/server/routes/project.js";

vi.mock("../../src/application/scan.js", () => ({
  scan: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

import { spawn } from "node:child_process";
import { scan } from "../../src/application/scan.js";

const mockSpawn = vi.mocked(spawn);

const mockScan = vi.mocked(scan);

function mockFolderDialog(path: string): void {
  mockSpawn.mockImplementation(() => {
    return {
      stdout: {
        on(event: string, handler: (chunk: Buffer) => void) {
          if (event === "data") {
            queueMicrotask(() => handler(Buffer.from(path)));
          }
        },
      },
      stderr: { on: vi.fn() },
      on(event: string, handler: (code: number) => void) {
        if (event === "close") {
          queueMicrotask(() => handler(0));
        }
      },
      kill: vi.fn(),
    } as unknown as ReturnType<typeof spawn>;
  });
}

function mockFolderDialogCancelled(): void {
  mockSpawn.mockImplementation(() => {
    return {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on(event: string, handler: (code: number) => void) {
        if (event === "close") {
          queueMicrotask(() => handler(0));
        }
      },
      kill: vi.fn(),
    } as unknown as ReturnType<typeof spawn>;
  });
}

function mockFolderDialogUnavailable(): void {
  mockSpawn.mockImplementation(() => {
    return {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on(event: string, handler: (err: Error) => void) {
        if (event === "error") {
          queueMicrotask(() => handler(new Error("spawn ENOENT")));
        }
      },
      kill: vi.fn(),
    } as unknown as ReturnType<typeof spawn>;
  });
}

function mockFolderDialogPending(): { complete: () => void } {
  let closeHandler: ((code: number) => void) | undefined;

  mockSpawn.mockImplementation(() => {
    return {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on(event: string, handler: (code: number) => void) {
        if (event === "close") {
          closeHandler = handler;
        }
      },
      kill: vi.fn(),
    } as unknown as ReturnType<typeof spawn>;
  });

  return {
    complete: () => closeHandler?.(0),
  };
}

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
    mockSpawn.mockReset();
    resetBrowseInFlightForTests();
  });

  afterEach(() => {
    clearLastScan();
    resetBrowseInFlightForTests();
  });

  describe("GET /api/project/config", () => {
    it("returns default project path", async () => {
      const response = await request(app).get("/api/project/config");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ defaultProjectPath: getDefaultProjectPath() });
    });
  });

  describe("POST /api/project/browse", () => {
    it("returns chosen folder path", async () => {
      mockFolderDialog("D:\\picked\\project");

      const response = await request(app).post("/api/project/browse").send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ cancelled: false, path: "D:\\picked\\project" });
      expect(mockSpawn).toHaveBeenCalledOnce();
    });

    it("returns dismissed when dialog is closed without a selection", async () => {
      mockFolderDialogCancelled();

      const response = await request(app).post("/api/project/browse").send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ cancelled: true, reason: "dismissed" });
    });

    it("returns unavailable when the picker cannot be spawned", async () => {
      mockFolderDialogUnavailable();

      const response = await request(app).post("/api/project/browse").send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ cancelled: true, reason: "unavailable" });
    });

    it("returns busy when a browse dialog is already in flight", async () => {
      const pending = mockFolderDialogPending();

      const first = pickNativeFolder();
      const second = await pickNativeFolder();

      expect(second).toEqual({ cancelled: true, reason: "busy" });

      pending.complete();
      await expect(first).resolves.toEqual({ cancelled: true, reason: "dismissed" });
    });

    it("rejects requests without application/json Content-Type", async () => {
      const response = await request(app).post("/api/project/browse");

      expect(response.status).toBe(415);
    });
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

    it("defaults project path via getDefaultProjectPath when body omits projectPath", async () => {
      const result = makeScanResult();
      mockScan.mockResolvedValue(result);

      const response = await request(app).post("/api/project/scan").send({});

      expect(response.status).toBe(200);
      expect(mockScan).toHaveBeenCalledWith({ projectPath: getDefaultProjectPath() });
    });

    it("defaults project path when body contains blank projectPath", async () => {
      const result = makeScanResult();
      mockScan.mockResolvedValue(result);

      const response = await request(app).post("/api/project/scan").send({ projectPath: "   " });

      expect(response.status).toBe(200);
      expect(mockScan).toHaveBeenCalledWith({ projectPath: getDefaultProjectPath() });
    });

    it("returns 500 when scan fails", async () => {
      mockScan.mockRejectedValue(new Error("ENOENT: no such directory"));

      const response = await request(app)
        .post("/api/project/scan")
        .send({ projectPath: "/missing/project" });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: "ENOENT: no such directory" });
    });
  });
});
