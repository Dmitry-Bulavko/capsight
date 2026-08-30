import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { PlatformVersion } from "../../src/core/model/index.js";
import type {
  ClaudeAgent as Agent,
  ClaudeProjectSnapshot as ProjectSnapshot,
} from "../../src/adapters/claude/model/index.js";
import type { ScanResult } from "../../src/application/scan.js";
import { clearLastScan, scanAndStore } from "../../src/application/scan-store.js";
import { app } from "../../src/server/index.js";
import {
  buildAllowedApiOrigins,
  createApiMutationGuard,
} from "../../src/server/middleware/api-guard.js";

vi.mock("../../src/application/scan.js", () => ({
  scan: vi.fn(),
}));

vi.mock("../../src/application/detect-platforms.js", () => ({
  detectPlatforms: vi.fn(),
}));

import { scan } from "../../src/application/scan.js";
import { detectPlatforms } from "../../src/application/detect-platforms.js";

const mockScan = vi.mocked(scan);
const mockDetectPlatforms = vi.mocked(detectPlatforms);

const SECRET_ENV_VALUE = "ghp_ecosystem_secret_value";
const SECRET_SETTINGS_VALUE = "settings_secret_token_value";

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
    path: "",
  },
  status: "active",
  configuration: { unknownFields: {} },
  isPluginAgent: false,
};

function makeSnapshot(projectPath: string, overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  const agentPath = path.join(projectPath, ".claude", "agents", "backend.md");
  return {
    id: "snapshot-1",
    projectPath,
    version: mockVersion,
    environment: { relevant: [] },
    trust: { accepted: true, projectPath },
    agents: [
      {
        ...mockAgent,
        source: {
          platform: "claude",
          scope: "project",
          path: agentPath,
        },
      },
    ],
    skills: [],
    instructions: [],
    mcpServers: [
      {
        id: "mcp-1",
        name: "github",
        source: { platform: "claude", scope: "project", path: path.join(projectPath, ".mcp.json") },
        configPath: path.join(projectPath, ".mcp.json"),
        transport: "stdio",
        definitionKind: "config-file",
        status: "configured",
        configHash: "hash-1",
        envKeys: ["GITHUB_TOKEN"],
        headerKeys: ["Authorization"],
      },
    ],
    settings: [
      {
        scope: "project",
        path: path.join(projectPath, ".claude", "settings.json"),
        priority: 30,
        permissions: {
          rules: [
            {
              action: "allow",
              index: 0,
              raw: `Bash(curl --header Authorization:${SECRET_SETTINGS_VALUE})`,
            },
          ],
        },
      },
    ],
    warnings: [],
    scannedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeScanResult(projectPath: string, overrides: Partial<ProjectSnapshot> = {}): ScanResult {
  return {
    platform: "claude",
    status: "complete",
    snapshot: makeSnapshot(projectPath, overrides),
  };
}

const tempDirs: string[] = [];

async function makeTempProject(): Promise<string> {
  const dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "capsight-ecosystem-api-")));
  tempDirs.push(dir);
  return dir;
}

async function seedProject(projectPath: string): Promise<void> {
  const agentPath = path.join(projectPath, ".claude", "agents", "backend.md");
  const mcpPath = path.join(projectPath, ".mcp.json");
  const settingsPath = path.join(projectPath, ".claude", "settings.json");

  await fs.mkdir(path.dirname(agentPath), { recursive: true });
  await fs.writeFile(
    agentPath,
    `---
name: backend
description: Backend agent
---
# Backend body
`,
  );
  await fs.writeFile(
    mcpPath,
    JSON.stringify({
      mcpServers: {
        github: {
          command: "npx",
          env: {
            GITHUB_TOKEN: SECRET_ENV_VALUE,
          },
          headers: {
            Authorization: SECRET_ENV_VALUE,
          },
        },
      },
    }),
  );
  await fs.writeFile(
    settingsPath,
    JSON.stringify({
      permissions: {
        allow: [`Bash(curl --header Authorization:${SECRET_SETTINGS_VALUE})`],
      },
    }),
  );
}

async function storeScan(projectPath: string): Promise<ScanResult> {
  const scanResult = makeScanResult(projectPath);
  mockDetectPlatforms.mockResolvedValue([
    {
      platform: "claude",
      status: "detected",
      evidence: [{ platform: "claude", scope: "project", path: projectPath }],
    },
    { platform: "cursor", status: "not-detected", evidence: [] },
    { platform: "codex", status: "not-detected", evidence: [] },
  ]);
  mockScan.mockResolvedValue(scanResult);
  return scanAndStore(projectPath);
}

describe("ecosystem API routes", () => {
  beforeEach(() => {
    clearLastScan();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    clearLastScan();
    await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
  });

  it("GET /api/ecosystem returns inventory, detection and compat verdicts", async () => {
    const projectPath = await makeTempProject();
    await seedProject(projectPath);
    await storeScan(projectPath);

    const response = await request(app).get("/api/ecosystem").expect(200);

    expect(response.body.projectPath).toBe(projectPath);
    expect(response.body.detection).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ platform: "claude", status: "detected" }),
      ]),
    );
    expect(response.body.resources.agent).toHaveLength(1);
    expect(response.body.resources.agent[0].compat).toMatchObject({
      claude: expect.objectContaining({ support: expect.any(String) }),
      cursor: expect.objectContaining({ support: expect.any(String) }),
      codex: expect.objectContaining({ support: expect.any(String) }),
    });
    expect(response.body.resources.mcp_server).toHaveLength(1);
    expect(response.body.health).toBeDefined();
    expect(response.body.health.platforms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          platform: "claude",
          agents: expect.objectContaining({
            active: expect.objectContaining({ count: expect.any(Number), resourceIds: expect.any(Array) }),
          }),
        }),
      ]),
    );
    const healthSerialized = JSON.stringify(response.body.health);
    expect(healthSerialized).not.toMatch(/score|grade|rating|maturity/i);
  });

  it("GET /api/ecosystem/resource/:id returns metadata, related paths and overlaps", async () => {
    const projectPath = await makeTempProject();
    await seedProject(projectPath);
    await storeScan(projectPath);

    const ecosystem = await request(app).get("/api/ecosystem").expect(200);
    const agentId = ecosystem.body.resources.agent[0].id as string;

    const response = await request(app).get(`/api/ecosystem/resource/${encodeURIComponent(agentId)}`);

    expect(response.status).toBe(200);
    expect(response.body.resource.id).toBe(agentId);
    expect(response.body.relatedFiles[0]).toMatchObject({
      role: "primary",
      path: path.join(projectPath, ".claude", "agents", "backend.md"),
    });
    expect(response.body.relatedFolders.length).toBeGreaterThan(0);
    expect(response.body.overlaps).toEqual([]);
    expect(response.body.snapshot).toMatchObject({ id: "backend", name: "backend" });
  });

  it("returns 404 for an id absent from inventory without reading the filesystem", async () => {
    const projectPath = await makeTempProject();
    await seedProject(projectPath);
    await storeScan(projectPath);
    const readSpy = vi.spyOn(fs, "readFile");

    const response = await request(app).get("/api/ecosystem/resource/claude:agent:missing/content");

    expect(response.status).toBe(404);
    expect(readSpy).not.toHaveBeenCalled();
    readSpy.mockRestore();
  });

  it("returns 415 for mcp_server content requests", async () => {
    const projectPath = await makeTempProject();
    await seedProject(projectPath);
    await storeScan(projectPath);

    const ecosystem = await request(app).get("/api/ecosystem").expect(200);
    const mcpId = ecosystem.body.resources.mcp_server[0].id as string;

    const response = await request(app).get(
      `/api/ecosystem/resource/${encodeURIComponent(mcpId)}/content`,
    );

    expect(response.status).toBe(415);
    expect(response.body.error).toMatch(/mcp_server/i);
  });

  it("serves markdown-class content for inventory agents", async () => {
    const projectPath = await makeTempProject();
    await seedProject(projectPath);
    await storeScan(projectPath);

    const ecosystem = await request(app).get("/api/ecosystem").expect(200);
    const agentId = ecosystem.body.resources.agent[0].id as string;

    const response = await request(app).get(
      `/api/ecosystem/resource/${encodeURIComponent(agentId)}/content`,
    );

    expect(response.status).toBe(200);
    expect(response.body.frontmatter).toMatchObject({ name: "backend" });
    expect(response.body.body).toContain("# Backend body");
    expect(response.body.truncated).toBe(false);
  });

  it("refuses paths outside scanned roots on the content route", async () => {
    const projectPath = await makeTempProject();
    const outside = await makeTempProject();
    const outsideFile = path.join(outside, "outside.md");
    await fs.writeFile(outsideFile, "# Outside\n");

    const scanResult = makeScanResult(projectPath, {
      agents: [
        {
          ...mockAgent,
          id: "outside",
          name: "outside",
          source: {
            platform: "claude",
            scope: "project",
            path: outsideFile,
          },
        },
      ],
    });
    mockDetectPlatforms.mockResolvedValue([
      {
        platform: "claude",
        status: "detected",
        evidence: [{ platform: "claude", scope: "project", path: projectPath }],
      },
      { platform: "cursor", status: "not-detected", evidence: [] },
      { platform: "codex", status: "not-detected", evidence: [] },
    ]);
    mockScan.mockResolvedValue(scanResult);
    await scanAndStore(projectPath);

    const response = await request(app).get(
      `/api/ecosystem/resource/${encodeURIComponent("claude:agent:outside")}/content`,
    );

    expect(response.status).toBe(403);
  });

  it("never emits MCP env/header values or settings values in ecosystem responses", async () => {
    const projectPath = await makeTempProject();
    await seedProject(projectPath);
    await storeScan(projectPath);

    const ecosystem = await request(app).get("/api/ecosystem").expect(200);
    const mcpId = ecosystem.body.resources.mcp_server[0].id as string;
    const detail = await request(app)
      .get(`/api/ecosystem/resource/${encodeURIComponent(mcpId)}`)
      .expect(200);

    const payloads = [ecosystem.body, detail.body];
    for (const payload of payloads) {
      const serialized = JSON.stringify(payload);
      expect(serialized).not.toContain(SECRET_ENV_VALUE);
      expect(serialized).not.toContain(SECRET_SETTINGS_VALUE);
    }
    expect(JSON.stringify(detail.body.snapshot)).toContain("GITHUB_TOKEN");
    expect(JSON.stringify(detail.body.snapshot)).toContain("Authorization");
  });
});

describe("ecosystem content origin guard", () => {
  it("rejects GET content requests from a foreign Origin", () => {
    const guard = createApiMutationGuard(buildAllowedApiOrigins(3847));
    const res = {
      statusCode: 200,
      body: undefined as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      },
    };
    const next = vi.fn();

    guard(
      {
        method: "GET",
        path: "/api/ecosystem/resource/claude:agent:backend/content",
        headers: { origin: "https://evil.example" },
      } as never,
      res as never,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});
