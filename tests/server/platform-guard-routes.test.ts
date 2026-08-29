import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { PlatformId } from "../../src/adapters/platform.js";
import type { PlatformVersion, ProjectSnapshot } from "../../src/core/model/index.js";
import type { ScanResult } from "../../src/application/scan.js";
import { clearLastScan, setLastScan } from "../../src/application/scan-store.js";
import { app } from "../../src/server/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE_PATH = path.join(
  __dirname,
  "../fixtures/claude/managed-simulation/managed-bundle",
);

function makeSnapshot(platform: PlatformId): ProjectSnapshot {
  const version: PlatformVersion = {
    platform,
    version: "1.0.0",
    raw: "1.0.0",
    detectedAt: "2026-01-01T00:00:00.000Z",
  };

  return {
    id: "snapshot-non-claude",
    projectPath: "/mock/project",
    version,
    environment: { relevant: [] },
    trust: { accepted: false, projectPath: "/mock/project" },
    agents: [
      {
        id: "agent-example",
        name: "example",
        description: "Example agent",
        source: {
          platform,
          scope: "project",
          path: "/mock/project/.cursor/agents/example.md",
        },
        status: "active",
        configuration: { tools: ["Read"], unknownFields: {} } as ProjectSnapshot["agents"][number]["configuration"],
        isPluginAgent: false,
      },
    ],
    skills: [],
    instructions: [],
    mcpServers: [],
    settings: [],
    warnings: [],
    scannedAt: "2026-01-01T12:00:00.000Z",
  };
}

function makeScanResult(platform: PlatformId): ScanResult {
  return {
    platform,
    snapshot: makeSnapshot(platform),
    status: "complete",
  };
}

describe("platform guard API routes", () => {
  beforeEach(() => {
    clearLastScan();
  });

  afterEach(() => {
    clearLastScan();
  });

  describe.each(["cursor", "codex"] as const)("%s snapshot", (platform) => {
    beforeEach(() => {
      setLastScan(makeScanResult(platform));
    });

    it("returns 501 for POST /api/plan", async () => {
      const response = await request(app)
        .post("/api/plan")
        .send({ pending: { byAgent: {} }, editSnapshotId: "snapshot-non-claude" });

      expect(response.status).toBe(501);
      expect(response.body.error).toContain(platform);
    });

    it("returns 501 for POST /api/apply", async () => {
      const response = await request(app)
        .post("/api/apply")
        .send({
          pending: { byAgent: {} },
          editSnapshotId: "snapshot-non-claude",
          confirmed: true,
        });

      expect(response.status).toBe(501);
      expect(response.body.error).toContain(platform);
    });

    it("returns 501 for POST /api/simulate/managed", async () => {
      const response = await request(app)
        .post("/api/simulate/managed")
        .send({ managedBundlePath: BUNDLE_PATH });

      expect(response.status).toBe(501);
      expect(response.body.error).toContain(platform);
    });

    it("returns 501 for GET /api/graph", async () => {
      const response = await request(app).get("/api/graph");

      expect(response.status).toBe(501);
      expect(response.body.error).toContain(platform);
    });
  });
});
