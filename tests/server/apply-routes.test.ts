import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { scan } from "../../src/application/scan.js";
import { clearLastScan, setLastScan } from "../../src/application/scan-store.js";
import { APPLY_SUCCESS_MESSAGE } from "../../src/application/apply.js";
import { app } from "../../src/server/index.js";

const tempDirs: string[] = [];

afterEach(async () => {
  clearLastScan();
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function makeTempProject(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "capsight-apply-api-"));
  tempDirs.push(dir);
  await fs.mkdir(path.join(dir, ".claude", "agents"), { recursive: true });
  await fs.writeFile(
    path.join(dir, ".claude", "agents", "backend.md"),
    `---
name: backend
description: Backend agent
tools:
  - Read
  - Grep
---

Body
`,
  );
  return dir;
}

describe("apply API routes", () => {
  let agentId = "";
  let snapshotId = "";
  let projectPath = "";

  beforeEach(async () => {
    projectPath = await makeTempProject();
    const scanResult = await scan({ projectPath });
    setLastScan(scanResult);
    snapshotId = scanResult.snapshot.id;
    agentId = scanResult.snapshot.agents.find((entry) => entry.name === "backend")!.id;
  });

  describe("POST /api/apply", () => {
    it("returns 404 when no scan is available", async () => {
      clearLastScan();
      const response = await request(app)
        .post("/api/apply")
        .send({
          pending: { byAgent: {} },
          editSnapshotId: snapshotId,
          confirmed: true,
        });

      expect(response.status).toBe(404);
    });

    it("returns 400 when apply is not confirmed", async () => {
      const response = await request(app)
        .post("/api/apply")
        .send({
          pending: { byAgent: { [agentId]: { Write: true } } },
          editSnapshotId: snapshotId,
          confirmed: false,
        });

      expect(response.status).toBe(400);
    });

    it("applies planned changes and returns confirmation message", async () => {
      const response = await request(app)
        .post("/api/apply")
        .send({
          pending: { byAgent: { [agentId]: { Write: true } } },
          editSnapshotId: snapshotId,
          confirmed: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe(APPLY_SUCCESS_MESSAGE);
      expect(response.body.operationId).toBeTruthy();
      expect(response.body.files).toHaveLength(1);
    });
  });

  describe("POST /api/rollback/:operationId", () => {
    it("restores configuration from backup", async () => {
      const applyResponse = await request(app)
        .post("/api/apply")
        .send({
          pending: { byAgent: { [agentId]: { Write: true } } },
          editSnapshotId: snapshotId,
          confirmed: true,
        });

      const operationId = applyResponse.body.operationId as string;

      const response = await request(app)
        .post(`/api/rollback/${operationId}`)
        .send({ confirmed: true });

      expect(response.status).toBe(200);
      expect(response.body.verified).toBe(true);
      expect(response.body.restoredFiles).toHaveLength(1);
    });
  });

  describe("GET /api/history", () => {
    it("returns operation history", async () => {
      const applyResponse = await request(app)
        .post("/api/apply")
        .send({
          pending: { byAgent: { [agentId]: { Write: true } } },
          editSnapshotId: snapshotId,
          confirmed: true,
        });

      await request(app)
        .post(`/api/rollback/${applyResponse.body.operationId}`)
        .send({ confirmed: true });

      const response = await request(app).get("/api/history");

      expect(response.status).toBe(200);
      expect(response.body.operations.length).toBeGreaterThanOrEqual(2);
    });
  });
});
