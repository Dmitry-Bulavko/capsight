import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Agent, PlatformVersion, ProjectSnapshot } from "../../src/core/model/index.js";
import type { ScanResult } from "../../src/application/scan.js";
import { clearLastScan, setLastScan } from "../../src/application/scan-store.js";
import { app } from "../../src/server/index.js";

const mockVersion: PlatformVersion = {
  platform: "claude",
  version: "2.1.0",
  raw: "2.1.0",
  detectedAt: "2026-01-01T00:00:00.000Z",
};

const mockAgent: Agent = {
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

function makeSnapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    id: "abc123",
    projectPath: "/mock/project",
    version: mockVersion,
    environment: { relevant: [] },
    trust: { accepted: false, projectPath: "/mock/project" },
    agents: [mockAgent],
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

describe("M1 agents API routes", () => {
  beforeEach(() => {
    clearLastScan();
  });

  afterEach(() => {
    clearLastScan();
  });

  describe("GET /api/agents/:id/effective", () => {
    it("returns 404 when no scan exists", async () => {
      const response = await request(app).get("/api/agents/backend/effective");

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "No scan available" });
    });

    it("returns 404 when agent does not exist", async () => {
      setLastScan(makeScanResult());

      const response = await request(app).get("/api/agents/missing/effective");

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "Agent not found: missing" });
    });

    it("returns 400 for invalid context preset", async () => {
      setLastScan(makeScanResult());

      const response = await request(app).get(
        "/api/agents/backend/effective?context=invalid-preset",
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/Invalid context preset/);
    });

    it("returns effective configuration for agent with default context", async () => {
      setLastScan(makeScanResult());

      const response = await request(app).get("/api/agents/backend/effective");

      expect(response.status).toBe(200);
      expect(response.body.agentId).toBe("backend");
      expect(response.body.context.preset).toBe("main-session");
      expect(response.body.version).toEqual(mockVersion);
      expect(Array.isArray(response.body.capabilities)).toBe(true);
      expect(response.body.capabilities.length).toBeGreaterThan(0);
      expect(typeof response.body.unknownRate).toBe("number");
    });

    it("applies context, depth, and parentMode query parameters", async () => {
      setLastScan(makeScanResult());

      const response = await request(app).get(
        "/api/agents/backend/effective?context=background-subagent&depth=1&parentMode=auto",
      );

      expect(response.status).toBe(200);
      expect(response.body.context).toMatchObject({
        preset: "background-subagent",
        depth: 1,
        parentPermissionMode: "auto",
        isBackground: true,
      });
    });

    it("differs between foreground and fork contexts", async () => {
      setLastScan(makeScanResult());

      const foreground = await request(app).get(
        "/api/agents/backend/effective?context=foreground-subagent",
      );
      const fork = await request(app).get("/api/agents/backend/effective?context=fork");

      expect(foreground.status).toBe(200);
      expect(fork.status).toBe(200);
      expect(foreground.body.capabilities).not.toEqual(fork.body.capabilities);
    });
  });

  describe("GET /api/capabilities/:id/explain", () => {
    it("returns 404 when no scan exists", async () => {
      const response = await request(app).get(
        "/api/capabilities/Read/explain?agent=backend",
      );

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "No scan available" });
    });

    it("returns 400 when agent query parameter is missing", async () => {
      setLastScan(makeScanResult());

      const response = await request(app).get("/api/capabilities/Read/explain");

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "Missing required query parameter: agent" });
    });

    it("returns 404 when capability does not exist", async () => {
      setLastScan(makeScanResult());

      const response = await request(app).get(
        "/api/capabilities/nonexistent-tool/explain?agent=backend",
      );

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "Capability not found: nonexistent-tool" });
    });

    it("returns capability explanation with sources and reasons", async () => {
      setLastScan(makeScanResult());

      const response = await request(app).get(
        "/api/capabilities/Read/explain?agent=backend&context=foreground-subagent",
      );

      expect(response.status).toBe(200);
      expect(response.body.agentId).toBe("backend");
      expect(response.body.context.preset).toBe("foreground-subagent");
      expect(response.body.capability.capabilityId).toBe("Read");
      expect(response.body.capability.sources.length).toBeGreaterThanOrEqual(1);
      expect(response.body.capability.reasons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("GET /api/warnings", () => {
    it("returns 404 when no scan exists", async () => {
      const response = await request(app).get("/api/warnings");

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "No scan available" });
    });

    it("returns warnings from active agents with agentId", async () => {
      setLastScan(makeScanResult());

      const response = await request(app).get("/api/warnings");

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.warnings)).toBe(true);
      for (const warning of response.body.warnings) {
        expect(warning.agentId).toBe("backend");
        expect(warning).toMatchObject({
          category: expect.any(String),
          severity: expect.any(String),
          message: expect.any(String),
          evidence: expect.any(Array),
        });
      }
    });

    it("includes Bash guardrail warning when restrictions coexist with Bash access", async () => {
      setLastScan(
        makeScanResult({
          agents: [
            {
              ...mockAgent,
              configuration: {
                tools: ["Read", "Bash"],
                unknownFields: {},
              },
            },
          ],
        }),
      );

      const response = await request(app).get("/api/warnings");

      expect(response.status).toBe(200);
      const bashWarning = response.body.warnings.find(
        (warning: { message: string }) => warning.message.includes("Bash access"),
      );
      expect(bashWarning).toBeDefined();
    });

    it("skips non-active agents", async () => {
      setLastScan(
        makeScanResult({
          agents: [
            mockAgent,
            {
              ...mockAgent,
              id: "invalid-agent",
              name: "invalid-agent",
              status: "invalid",
              invalidReason: "no-description",
            },
          ],
        }),
      );

      const response = await request(app).get("/api/warnings");

      expect(response.status).toBe(200);
      const agentIds = response.body.warnings.map((warning: { agentId: string }) => warning.agentId);
      expect(agentIds).not.toContain("invalid-agent");
    });
  });
});
