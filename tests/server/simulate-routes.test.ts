import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { PlatformVersion } from "../../src/core/model/index.js";
import type { ClaudeProjectSnapshot as ProjectSnapshot } from "../../src/adapters/claude/model/index.js";
import type { ScanResult } from "../../src/application/scan.js";
import { clearLastScan, setLastScan } from "../../src/application/scan-store.js";
import { app } from "../../src/server/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE_PATH = path.join(
  __dirname,
  "../fixtures/claude/managed-simulation/managed-bundle",
);

const mockVersion: PlatformVersion = {
  platform: "claude",
  version: "2.1.0",
  raw: "2.1.0",
  detectedAt: "2026-01-01T00:00:00.000Z",
};

function makeSnapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    id: "snapshot-managed",
    projectPath: "/mock/project",
    version: mockVersion,
    environment: { relevant: [] },
    trust: { accepted: false, projectPath: "/mock/project" },
    agents: [
      {
        id: "project-backend",
        name: "backend",
        description: "Project backend agent",
        source: {
          platform: "claude",
          scope: "project",
          path: "/mock/project/.claude/agents/backend.md",
        },
        status: "active",
        configuration: {
          model: "blocked-model",
          tools: ["Read", "Write"],
          unknownFields: {},
        },
        isPluginAgent: false,
      },
    ],
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

describe("simulate API routes", () => {
  beforeEach(() => {
    clearLastScan();
  });

  afterEach(() => {
    clearLastScan();
  });

  describe("POST /api/simulate/managed", () => {
    it("returns 404 when no scan is available", async () => {
      const response = await request(app)
        .post("/api/simulate/managed")
        .send({ managedBundlePath: BUNDLE_PATH });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "No scan available" });
    });

    it("returns 400 when managedBundlePath is missing", async () => {
      setLastScan(makeScanResult());

      const response = await request(app).post("/api/simulate/managed").send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Missing required body field: managedBundlePath",
      });
    });

    it("returns managed simulation delta", async () => {
      setLastScan(makeScanResult());

      const response = await request(app)
        .post("/api/simulate/managed")
        .send({ managedBundlePath: BUNDLE_PATH });

      expect(response.status).toBe(200);
      expect(response.body.snapshotId).toBe("snapshot-managed");
      expect(response.body.bundlePath).toBe(path.resolve(BUNDLE_PATH));
      expect(response.body.delta.shadowedAgents).toHaveLength(1);
      expect(response.body.delta.modelChanges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            agentName: "backend",
            declared: "blocked-model",
            effective: "unknown",
          }),
        ]),
      );
    });
  });
});
