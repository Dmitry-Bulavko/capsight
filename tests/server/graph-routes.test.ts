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
import {
  CONTEXT_PRESETS,
  DEFAULT_CONTEXT_PRESET,
  DEFAULT_CONTEXT_REASON,
} from "../../src/core/model/context-presets.js";

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
    tools: ["Read", "Write", "Grep", "Bash", "Agent"],
    disallowedTools: ["Bash"],
    unknownFields: {},
  },
  isPluginAgent: false,
};

const workerAgent: Agent = {
  id: "worker",
  name: "worker",
  description: "Worker agent",
  source: {
    platform: "claude",
    scope: "project",
    path: "/mock/project/.claude/agents/worker.md",
  },
  status: "active",
  configuration: {
    tools: ["Read", "Write"],
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
    platform: "claude",
    snapshot: makeSnapshot(overrides),
    status: "complete",
  };
}

describe("GET /api/graph", () => {
  beforeEach(() => {
    clearLastScan();
  });

  afterEach(() => {
    clearLastScan();
  });

  it("returns 404 when no scan exists", async () => {
    const response = await request(app).get("/api/graph");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "No scan available" });
  });

  it("returns 400 for invalid context preset", async () => {
    setLastScan(makeScanResult());

    const response = await request(app).get("/api/graph?context=invalid-preset");

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Invalid context preset/);
    for (const preset of CONTEXT_PRESETS) {
      expect(response.body.error).toContain(preset);
    }
  });

  it("defaults to background-subagent and says so (§4.3)", async () => {
    setLastScan(makeScanResult());

    const response = await request(app).get("/api/graph");

    expect(response.status).toBe(200);
    expect(response.body.context.preset).toBe(DEFAULT_CONTEXT_PRESET);
    expect(response.body.contextDefault).toEqual({
      preset: DEFAULT_CONTEXT_PRESET,
      reason: DEFAULT_CONTEXT_REASON,
    });
  });

  it("returns inspection graph with nodes and edges", async () => {
    setLastScan(makeScanResult());

    const response = await request(app).get("/api/graph?context=foreground-subagent");

    expect(response.status).toBe(200);
    expect(response.body.context.preset).toBe("foreground-subagent");
    expect(response.body.contextDefault).toBeUndefined();
    expect(Array.isArray(response.body.nodes)).toBe(true);
    expect(Array.isArray(response.body.edges)).toBe(true);
    expect(response.body.nodes.length).toBeGreaterThan(0);
    expect(response.body.nodes.some((node: { kind: string }) => node.kind === "agent")).toBe(
      true,
    );
    expect(response.body.nodes.some((node: { kind: string }) => node.kind === "tool")).toBe(
      true,
    );
  });

  it("differs between foreground and fork contexts", async () => {
    setLastScan(makeScanResult());

    const foreground = await request(app).get("/api/graph?context=foreground-subagent");
    const fork = await request(app).get("/api/graph?context=fork");

    expect(foreground.status).toBe(200);
    expect(fork.status).toBe(200);
    expect(foreground.body.edges).not.toEqual(fork.body.edges);
  });

  it("returns 400 for an unknown agent query parameter", async () => {
    setLastScan(makeScanResult({ agents: [mockAgent, workerAgent] }));

    const response = await request(app).get("/api/graph?agent=missing-agent");

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Invalid agent: missing-agent/);
  });

  it("returns a per-agent subgraph when agent is set", async () => {
    setLastScan(makeScanResult({ agents: [mockAgent, workerAgent] }));

    const full = await request(app).get("/api/graph?context=main-session");
    const scoped = await request(app).get("/api/graph?context=main-session&agent=backend");

    expect(full.status).toBe(200);
    expect(scoped.status).toBe(200);
    expect(scoped.body.nodes.some((node: { id: string }) => node.id === "agent:backend")).toBe(
      true,
    );
    expect(scoped.body.nodes.some((node: { id: string }) => node.id === "agent:worker")).toBe(
      true,
    );
    expect(
      scoped.body.edges.some(
        (edge: { source: string; target: string; kind: string }) =>
          edge.kind === "agent-agent" &&
          edge.source === "agent:backend" &&
          edge.target === "agent:worker",
      ),
    ).toBe(true);
    expect(
      scoped.body.edges.some(
        (edge: { source: string }) => edge.source === "agent:worker",
      ),
    ).toBe(false);
    expect(
      full.body.edges.some(
        (edge: { source: string }) => edge.source === "agent:worker",
      ),
    ).toBe(true);
    expect(scoped.body.edges.length).toBeLessThan(full.body.edges.length);
  });
});
