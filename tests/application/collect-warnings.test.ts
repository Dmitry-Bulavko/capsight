import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { PlatformVersion } from "../../src/core/model/index.js";
import type {
  ClaudeAgent as Agent,
  ClaudeProjectSnapshot as ProjectSnapshot,
} from "../../src/adapters/claude/model/index.js";
import { collectAgentWarnings } from "../../src/application/collect-warnings.js";
import type { ScanResult } from "../../src/application/scan.js";
import { clearLastScan, setLastScan } from "../../src/application/scan-store.js";
import { buildExecutionContext } from "../../src/adapters/claude/resolution/context.js";
import { runWarnings } from "../../src/cli/index.js";
import {
  DEFAULT_CONTEXT_PRESET,
  DEFAULT_CONTEXT_REASON,
} from "../../src/core/model/context-presets.js";
import { app } from "../../src/server/index.js";

const mockVersion: PlatformVersion = {
  platform: "claude",
  version: "2.1.233",
  raw: "2.1.233 (mock)",
  detectedAt: "2026-01-01T00:00:00.000Z",
};

const warningAgent: Agent = {
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
    tools: ["Read", "Bash"],
    permissionMode: "bypassPermissions",
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
    agents: [warningAgent],
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

function sortWarnings<T extends { agentId: string; category: string; message: string }>(
  warnings: T[],
): T[] {
  return [...warnings].sort((left, right) => {
    const byAgent = left.agentId.localeCompare(right.agentId);
    if (byAgent !== 0) {
      return byAgent;
    }
    const byCategory = left.category.localeCompare(right.category);
    if (byCategory !== 0) {
      return byCategory;
    }
    return left.message.localeCompare(right.message);
  });
}

describe("collectAgentWarnings()", () => {
  beforeEach(() => {
    clearLastScan();
  });

  afterEach(() => {
    clearLastScan();
  });

  it("collects warnings from active agents with agentId", async () => {
    const snapshot = makeSnapshot();
    const context = buildExecutionContext(DEFAULT_CONTEXT_PRESET);

    const warnings = await collectAgentWarnings({ snapshot, context });

    expect(warnings.length).toBeGreaterThan(0);
    for (const warning of warnings) {
      expect(warning.agentId).toBe("backend");
      expect(warning).toMatchObject({
        category: expect.any(String),
        severity: expect.any(String),
        message: expect.any(String),
        evidence: expect.any(Array),
      });
    }
  });

  it("skips non-active agents", async () => {
    const snapshot = makeSnapshot({
      agents: [
        warningAgent,
        {
          ...warningAgent,
          id: "invalid-agent",
          name: "invalid-agent",
          status: "invalid",
          invalidReason: "no-description",
        },
      ],
    });
    const context = buildExecutionContext(DEFAULT_CONTEXT_PRESET);

    const warnings = await collectAgentWarnings({ snapshot, context });

    const agentIds = warnings.map((warning) => warning.agentId);
    expect(agentIds).not.toContain("invalid-agent");
  });

  it("produces identical warning sets for CLI and API (§12.5 parity)", async () => {
    setLastScan(makeScanResult());
    const context = buildExecutionContext(DEFAULT_CONTEXT_PRESET);

    const cliResult = await runWarnings();
    const apiResponse = await request(app).get("/api/warnings");
    const helperWarnings = await collectAgentWarnings({
      snapshot: makeSnapshot(),
      context,
    });

    expect(apiResponse.status).toBe(200);
    expect(sortWarnings(cliResult.warnings)).toEqual(sortWarnings(apiResponse.body.warnings));
    expect(sortWarnings(helperWarnings)).toEqual(sortWarnings(cliResult.warnings));
    expect(cliResult.contextDefault).toEqual({
      preset: DEFAULT_CONTEXT_PRESET,
      reason: DEFAULT_CONTEXT_REASON,
    });
    expect(apiResponse.body.contextDefault).toEqual(cliResult.contextDefault);
  });

  it("matches CLI and API when context is explicitly set", async () => {
    setLastScan(makeScanResult());

    const cliResult = await runWarnings({ context: "foreground-subagent" });
    const apiResponse = await request(app).get("/api/warnings?context=foreground-subagent");

    expect(apiResponse.status).toBe(200);
    expect(sortWarnings(cliResult.warnings)).toEqual(sortWarnings(apiResponse.body.warnings));
    expect(cliResult.contextDefault).toBeUndefined();
    expect(apiResponse.body.contextDefault).toBeUndefined();
  });
});
