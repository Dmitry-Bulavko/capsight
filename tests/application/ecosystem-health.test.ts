import { describe, expect, it } from "vitest";
import { buildEcosystemInventory } from "../../src/application/ecosystem.js";
import {
  buildEcosystemHealth,
  healthFilterResourceIds,
} from "../../src/application/ecosystem-health.js";
import { buildStatusSummary } from "../../src/application/scan-store.js";
import type { ScanResult } from "../../src/application/scan.js";
import { RESOURCE_CLASS } from "../../src/core/compat/resource-class.js";
import type { Agent, ProjectSnapshot, Warning } from "../../src/core/model/index.js";
import {
  buildCompatVerdicts,
  buildEcosystemApiPayload,
} from "../../src/server/routes/ecosystem.js";

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "backend",
    name: "backend",
    description: "Backend agent",
    source: {
      platform: "claude",
      scope: "project",
      path: "/repo/.claude/agents/backend.md",
    },
    status: "active",
    configuration: { unknownFields: {} },
    isPluginAgent: false,
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    id: "snapshot-1",
    projectPath: "/repo",
    version: {
      platform: "claude",
      version: "1.0.0",
      raw: "1.0.0",
      detectedAt: "2026-01-01T00:00:00.000Z",
    },
    environment: { relevant: [] },
    trust: { accepted: true, projectPath: "/repo" },
    agents: [],
    skills: [],
    instructions: [],
    mcpServers: [],
    settings: [],
    warnings: [],
    scannedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeScanResult(
  platform: ScanResult["platform"],
  snapshotOverrides: Partial<ProjectSnapshot> = {},
): ScanResult {
  return {
    platform,
    status: "complete",
    snapshot: makeSnapshot({
      ...snapshotOverrides,
      version: {
        platform,
        version: "1.0.0",
        raw: "1.0.0",
        detectedAt: "2026-01-01T00:00:00.000Z",
      },
    }),
  };
}

function makeWarning(overrides: Partial<Warning> = {}): Warning {
  return {
    category: "advisory",
    severity: "warning",
    message: "Sample warning",
    evidence: [],
    ...overrides,
  };
}

describe("buildEcosystemHealth()", () => {
  it("matches buildStatusSummary agent counts per platform", () => {
    const claudeScan = makeScanResult("claude", {
      agents: [
        makeAgent({ id: "active", status: "active" }),
        makeAgent({
          id: "invalid",
          status: "invalid",
          source: { platform: "claude", scope: "project", path: "/repo/.claude/agents/invalid.md" },
        }),
        makeAgent({
          id: "shadowed",
          status: "shadowed",
          source: { platform: "claude", scope: "project", path: "/repo/.claude/agents/shadowed.md" },
        }),
        makeAgent({
          id: "ambiguous",
          status: "ambiguous",
          source: { platform: "claude", scope: "project", path: "/repo/.claude/agents/ambiguous.md" },
        }),
      ],
    });

    const inventory = buildEcosystemInventory({
      projectPath: "/repo",
      detection: [{ platform: "claude", status: "detected", evidence: [] }],
      scans: { claude: claudeScan },
    });
    const payload = buildEcosystemApiPayload(inventory, { claude: claudeScan });
    const health = buildEcosystemHealth({
      inventory,
      scans: { claude: claudeScan },
      resources: payload.resources,
    });

    const summary = buildStatusSummary(claudeScan);
    const claude = health.platforms.find((section) => section.platform === "claude")!;

    expect(claude.statusSummary?.agents).toEqual(summary.agents);
    expect(claude.agents.active.count).toBe(summary.agents.active);
    expect(claude.agents.invalid.count).toBe(summary.agents.invalid);
    expect(claude.agents.shadowed.count).toBe(summary.agents.shadowed);
    expect(claude.agents.ambiguous.count).toBe(summary.agents.ambiguous);
  });

  it("counts local overrides and unresolved collisions separately", () => {
    const claudeScan = makeScanResult("claude", {
      agents: [
        makeAgent({
          id: "local-agent",
          name: "local-agent",
          source: {
            platform: "claude",
            scope: "local",
            path: "/repo/.claude/agents/local-agent.md",
          },
        }),
        makeAgent({
          id: "repo-agent",
          name: "repo-agent",
          source: {
            platform: "claude",
            scope: "project",
            path: "/repo/.claude/agents/repo-agent.md",
          },
          collision: {
            candidates: [
              {
                platform: "claude",
                scope: "local",
                path: "/repo/.claude/agents/local-agent.md",
              },
            ],
            rule: "local-wins",
          },
        }),
      ],
    });

    const inventory = buildEcosystemInventory({
      projectPath: "/repo",
      detection: [{ platform: "claude", status: "detected", evidence: [] }],
      scans: { claude: claudeScan },
    });
    const payload = buildEcosystemApiPayload(inventory, { claude: claudeScan });
    const health = buildEcosystemHealth({
      inventory,
      scans: { claude: claudeScan },
      resources: payload.resources,
    });

    expect(health.localOverrides.count).toBe(1);
    expect(health.localOverrides.resourceIds).toEqual(["claude:agent:local-agent"]);
    expect(health.unresolvedCollisions.count).toBe(2);
    expect(health.unresolvedCollisions.resourceIds.sort()).toEqual(
      ["claude:agent:local-agent", "claude:agent:repo-agent"].sort(),
    );
  });

  it("counts resources with unknown compat explicitly", () => {
    const claudeScan = makeScanResult("claude", {
      agents: [makeAgent()],
      version: {
        platform: "claude",
        version: "unknown",
        raw: "unknown",
        detectedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    const inventory = buildEcosystemInventory({
      projectPath: "/repo",
      detection: [{ platform: "claude", status: "detected", evidence: [] }],
      scans: { claude: claudeScan },
    });
    const payload = buildEcosystemApiPayload(inventory, { claude: claudeScan });
    const health = buildEcosystemHealth({
      inventory,
      scans: { claude: claudeScan },
      resources: payload.resources,
    });

    expect(health.compatUnknown.count).toBeGreaterThan(0);
    expect(health.compatUnknown.resourceIds).toContain("claude:agent:backend");
  });

  it("groups snapshot warnings by severity and maps them to resources", () => {
    const claudeScan = makeScanResult("claude", {
      agents: [makeAgent()],
      warnings: [
        makeWarning({
          severity: "critical",
          evidence: [
            {
              platform: "claude",
              scope: "project",
              path: "/repo/.claude/agents/backend.md",
            },
          ],
        }),
        makeWarning({ severity: "info", message: "Unlinked warning" }),
      ],
    });

    const inventory = buildEcosystemInventory({
      projectPath: "/repo",
      detection: [{ platform: "claude", status: "detected", evidence: [] }],
      scans: { claude: claudeScan },
    });
    const payload = buildEcosystemApiPayload(inventory, { claude: claudeScan });
    const health = buildEcosystemHealth({
      inventory,
      scans: { claude: claudeScan },
      resources: payload.resources,
    });

    expect(health.warnings.critical.count).toBe(1);
    expect(health.warnings.info.count).toBe(1);
    expect(health.warnings.warning.count).toBe(0);
    expect(health.warnings.critical.resourceIds).toEqual(["claude:agent:backend"]);
    expect(health.warnings.info.resourceIds).toEqual([]);
  });

  it("exposes filter ids that resolve to exact resource sets", () => {
    const claudeScan = makeScanResult("claude", {
      skills: [
        {
          id: "lint",
          name: "lint",
          source: { platform: "claude", scope: "project", path: "/repo/.claude/skills/lint" },
          path: "/repo/.claude/skills/lint",
        },
      ],
    });

    const inventory = buildEcosystemInventory({
      projectPath: "/repo",
      detection: [{ platform: "claude", status: "detected", evidence: [] }],
      scans: { claude: claudeScan },
    });
    const payload = buildEcosystemApiPayload(inventory, { claude: claudeScan });
    const health = buildEcosystemHealth({
      inventory,
      scans: { claude: claudeScan },
      resources: payload.resources,
    });

    const skillIds = healthFilterResourceIds(health, "skills:claude");
    expect(skillIds).toEqual(["claude:skill:lint"]);
  });

  it("does not include score, grade, or rating fields", () => {
    const claudeScan = makeScanResult("claude", { agents: [makeAgent()] });
    const inventory = buildEcosystemInventory({
      projectPath: "/repo",
      detection: [{ platform: "claude", status: "detected", evidence: [] }],
      scans: { claude: claudeScan },
    });
    const payload = buildEcosystemApiPayload(inventory, { claude: claudeScan });
    const health = buildEcosystemHealth({
      inventory,
      scans: { claude: claudeScan },
      resources: payload.resources,
    });

    const serialized = JSON.stringify(health);
    expect(serialized).not.toMatch(/score|grade|rating|maturity/i);
  });

  it("counts MCP servers with not-supported or unknown compat verdicts", () => {
    const resource = {
      id: "claude:mcp_server:github",
      kind: "mcp_server" as const,
      platform: "claude",
      scope: "project" as const,
      resourceClass: RESOURCE_CLASS.MCP_JSON_CONFIG,
      path: "/repo/.mcp.json",
      name: "github",
      compat: buildCompatVerdicts(
        {
          id: "claude:mcp_server:github",
          kind: "mcp_server",
          platform: "claude",
          scope: "project",
          resourceClass: RESOURCE_CLASS.MCP_JSON_CONFIG,
          path: "/repo/.mcp.json",
          name: "github",
        },
        { claude: makeScanResult("claude"), codex: makeScanResult("codex") },
      ),
    };

    const inventory = buildEcosystemInventory({
      projectPath: "/repo",
      detection: [{ platform: "claude", status: "detected", evidence: [] }],
      scans: { claude: makeScanResult("claude") },
    });
    inventory.resources.mcp_server.push({
      id: resource.id,
      kind: "mcp_server",
      platform: "claude",
      scope: "project",
      resourceClass: RESOURCE_CLASS.MCP_JSON_CONFIG,
      path: "/repo/.mcp.json",
      name: "github",
    });

    const health = buildEcosystemHealth({
      inventory,
      scans: { claude: makeScanResult("claude"), codex: makeScanResult("codex") },
      resources: {
        agent: [],
        skill: [],
        instruction: [],
        mcp_server: [resource],
      },
    });

    const claude = health.platforms.find((section) => section.platform === "claude")!;
    expect(claude.mcpNotSupported.count + claude.mcpUnknown.count).toBeGreaterThan(0);
  });
});
