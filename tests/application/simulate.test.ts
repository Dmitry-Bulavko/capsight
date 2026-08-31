import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { PlatformVersion } from "../../src/core/model/index.js";
import { buildProjectSnapshot } from "../../src/adapters/claude/discovery/snapshot.js";
import type { WalkProjectScopesResult } from "../../src/adapters/claude/discovery/project-walk.js";
import {
  applyManagedOverlay,
  loadManagedBundle,
  resolveManagedModel,
} from "../../src/adapters/claude/discovery/managed-overlay.js";
import { simulateManagedOverlay } from "../../src/application/simulate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.join(__dirname, "../fixtures/claude/managed-simulation");
const PROJECT_PATH = path.join(FIXTURE_ROOT, "project");
const BUNDLE_PATH = path.join(FIXTURE_ROOT, "managed-bundle");

const VERSION: PlatformVersion = {
  platform: "claude",
  version: "2.1.0",
  raw: "2.1.0",
  detectedAt: "2026-01-01T00:00:00.000Z",
};

const WALK: WalkProjectScopesResult = {
  projectPath: PROJECT_PATH,
  repoRoot: PROJECT_PATH,
  scopes: [
    {
      path: PROJECT_PATH,
      hasClaudeDir: true,
      agentsPath: path.join(PROJECT_PATH, ".claude", "agents"),
      skillsPath: path.join(PROJECT_PATH, ".claude", "skills"),
    },
  ],
};

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("resolveManagedModel", () => {
  it("substitutes blocked models using availableModels (F8)", () => {
    expect(resolveManagedModel("blocked-model", ["claude-sonnet-4"])).toEqual({
      declared: "blocked-model",
      effective: "claude-sonnet-4",
      substituted: true,
    });
  });

  it("keeps declared model when allowlisted", () => {
    expect(resolveManagedModel("claude-sonnet-4", ["claude-sonnet-4"])).toEqual({
      declared: "claude-sonnet-4",
      effective: "claude-sonnet-4",
      substituted: false,
    });
  });
});

describe("managed simulation fixture", () => {
  it("loads bundle and overlays managed agents without writing", async () => {
    const snapshot = await buildProjectSnapshot({
      projectPath: PROJECT_PATH,
      version: VERSION,
      walk: WALK,
    });

    const projectBackend = snapshot.agents.find((agent) => agent.name === "backend");
    expect(projectBackend?.status).toBe("active");

    const bundle = await loadManagedBundle(BUNDLE_PATH);
    expect(bundle.agents).toHaveLength(1);
    expect(bundle.availableModels).toEqual(["claude-sonnet-4"]);

    const simulated = applyManagedOverlay(snapshot, bundle);
    const projectBackendAfter = simulated.agents.find(
      (agent) => agent.source.path === projectBackend?.source.path,
    );
    const managedBackend = simulated.agents.find(
      (agent) => agent.source.scope === "managed",
    );

    expect(managedBackend?.status).toBe("active");
    expect(projectBackendAfter?.status).toBe("shadowed");
    // The managed-over-project winner is A1, gated on the matrix like every
    // other collision rule (§8.2).
    expect(projectBackendAfter?.collision?.rule).toBe("A1");
    expect(projectBackendAfter?.collision?.matrixRef).toBe(
      "agent.collisionCrossScope",
    );
    expect(projectBackendAfter?.collision?.enforcement).toBe("enforced");
    expect((simulated.settings[0] as { scope: string }).scope).toBe("managed");
  });

  it("names no managed-over-project winner in degraded mode (§8.4)", async () => {
    const snapshot = await buildProjectSnapshot({
      projectPath: PROJECT_PATH,
      version: { ...VERSION, version: "unknown", raw: "" },
      walk: WALK,
    });

    const bundle = await loadManagedBundle(BUNDLE_PATH);
    const simulated = applyManagedOverlay(snapshot, bundle);

    const group = simulated.agents.filter((entry) => entry.name === "backend");
    expect(group).toHaveLength(2);
    for (const agent of group) {
      expect(agent.status).toBe("ambiguous");
      expect(agent.collision?.rule).toBe("A1");
      expect(agent.collision?.matrixRef).toBe("agent.collisionCrossScope");
      expect(agent.collision?.enforcement).toBe("unknown");
      expect(agent.collision?.effective).toBeUndefined();
    }
  });

  it("returns delta for shadowing, denied tools, and model changes", async () => {
    const snapshot = await buildProjectSnapshot({
      projectPath: PROJECT_PATH,
      version: VERSION,
      walk: WALK,
    });

    const result = await simulateManagedOverlay({
      managedBundlePath: BUNDLE_PATH,
      snapshot,
    });

    expect(result.snapshotId).toBe(snapshot.id);
    expect(result.bundlePath).toBe(path.resolve(BUNDLE_PATH));
    expect(result.delta.shadowedAgents).toHaveLength(1);
    expect(result.delta.shadowedAgents[0]).toMatchObject({
      agentName: "backend",
      previousStatus: "active",
      newStatus: "shadowed",
    });
    expect(result.delta.deniedTools.some((entry) => entry.capabilityId === "Write")).toBe(
      true,
    );
    expect(result.delta.modelChanges).toEqual([
      expect.objectContaining({
        agentName: "backend",
        declared: "blocked-model",
        effective: "unknown",
        matrixRef: "F8",
        enforcement: "enforced",
        effectiveEnforcement: "unknown",
      }),
    ]);
  });

  it("reports the F8 model block as undetermined in degraded mode (§8.3)", async () => {
    const snapshot = await buildProjectSnapshot({
      projectPath: PROJECT_PATH,
      version: { ...VERSION, version: "unknown", raw: "" },
      walk: WALK,
    });

    const result = await simulateManagedOverlay({
      managedBundlePath: BUNDLE_PATH,
      snapshot,
    });

    const change = result.delta.modelChanges[0]!;
    expect(change.enforcement).toBe("unknown");
    expect(change.effectiveEnforcement).toBe("unknown");
    expect(change.enforcementReason).toContain("SPEC §8.3");
    // The substitution is still reported; only the platform claim is not.
    expect(change.declared).toBe("blocked-model");
  });

  it("does not write to project or managed bundle paths", async () => {
    const snapshot = await buildProjectSnapshot({
      projectPath: PROJECT_PATH,
      version: VERSION,
      walk: WALK,
    });

    const projectAgentPath = path.join(PROJECT_PATH, ".claude", "agents", "backend.md");
    const managedAgentPath = path.join(BUNDLE_PATH, "agents", "backend.md");
    const managedSettingsPath = path.join(BUNDLE_PATH, "settings.json");

    const [beforeProject, beforeManagedAgent, beforeManagedSettings] = await Promise.all([
      fs.readFile(projectAgentPath, "utf8"),
      fs.readFile(managedAgentPath, "utf8"),
      fs.readFile(managedSettingsPath, "utf8"),
    ]);

    await simulateManagedOverlay({
      managedBundlePath: BUNDLE_PATH,
      snapshot,
    });

    const [afterProject, afterManagedAgent, afterManagedSettings] = await Promise.all([
      fs.readFile(projectAgentPath, "utf8"),
      fs.readFile(managedAgentPath, "utf8"),
      fs.readFile(managedSettingsPath, "utf8"),
    ]);

    expect(afterProject).toBe(beforeProject);
    expect(afterManagedAgent).toBe(beforeManagedAgent);
    expect(afterManagedSettings).toBe(beforeManagedSettings);
  });
});
