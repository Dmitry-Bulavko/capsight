import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformVersion } from "../../../src/core/model/index.js";
import type { DiscoveredInstruction, DiscoveredSkill } from "../../../src/adapters/cursor/discovery/types.js";
import { scan } from "../../../src/application/scan.js";
import { resolve } from "../../../src/application/resolve.js";
import { buildExecutionContext } from "../../../src/adapters/cursor/resolution/context.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const basicFixture = path.join(__dirname, "../../fixtures/cursor/basic/project");

const { mockDetectCursorVersion } = vi.hoisted(() => ({
  mockDetectCursorVersion: vi.fn<() => Promise<PlatformVersion>>(),
}));

vi.mock("../../../src/adapters/cursor/version/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/adapters/cursor/version/index.js")>();
  return {
    ...actual,
    detectCursorVersion: mockDetectCursorVersion,
    defaultCommandRunner: { run: vi.fn() },
  };
});

describe("cursor adapter", () => {
  afterEach(() => {
    mockDetectCursorVersion.mockReset();
  });

  it("scans cursor fixture project", async () => {
    mockDetectCursorVersion.mockResolvedValue({
      platform: "cursor",
      version: "3.16.17",
      raw: "3.16.17",
      detectedAt: "1970-01-01T00:00:00.000Z",
    });

    const result = await scan({ projectPath: basicFixture, platform: "cursor" });

    expect(result.platform).toBe("cursor");
    expect(result.snapshot.version.platform).toBe("cursor");
    expect(result.snapshot.agents.some((a) => a.name === "example" && a.status === "active")).toBe(
      true,
    );
    expect(result.snapshot.skills.length).toBeGreaterThan(0);
    expect(result.snapshot.instructions.length).toBeGreaterThan(0);
    expect(result.snapshot.mcpServers.length).toBeGreaterThan(0);
    expect(result.snapshot.trust.accepted).toBe("unknown");
  });

  it("does not discover ancestor repo .cursor metadata outside the workspace path", async () => {
    mockDetectCursorVersion.mockResolvedValue({
      platform: "cursor",
      version: "3.16.17",
      raw: "3.16.17",
      detectedAt: "1970-01-01T00:00:00.000Z",
    });

    const result = await scan({ projectPath: basicFixture, platform: "cursor" });
    const resolvedFixture = path.resolve(basicFixture);
    const withinFixture = (candidatePath: string) =>
      path.resolve(candidatePath).startsWith(resolvedFixture + path.sep) ||
      path.resolve(candidatePath) === resolvedFixture;

    for (const instruction of result.snapshot.instructions as DiscoveredInstruction[]) {
      expect(withinFixture(instruction.path)).toBe(true);
    }
    for (const skill of result.snapshot.skills as DiscoveredSkill[]) {
      expect(withinFixture(skill.path)).toBe(true);
    }
    for (const agent of result.snapshot.agents) {
      expect(agent.source.path).toBeDefined();
      expect(withinFixture(agent.source.path!)).toBe(true);
    }
    expect(
      (result.snapshot.instructions as DiscoveredInstruction[]).some((entry) =>
        entry.path.includes("capsight-orchestration"),
      ),
    ).toBe(false);
  });

  it("resolveEffective returns mostly unknown capabilities", async () => {
    mockDetectCursorVersion.mockResolvedValue({
      platform: "cursor",
      version: "3.16.17",
      raw: "3.16.17",
      detectedAt: "1970-01-01T00:00:00.000Z",
    });

    const scanResult = await scan({ projectPath: basicFixture, platform: "cursor" });
    const agent = scanResult.snapshot.agents.find(
      (entry) => entry.name === "example" && entry.status === "active",
    );
    expect(agent).toBeDefined();

    const effective = await resolve({
      snapshot: scanResult.snapshot,
      agentId: agent!.id,
      context: buildExecutionContext("background-subagent"),
    });

    expect(effective.capabilities.length).toBeGreaterThan(0);
    expect(effective.capabilities.every((cap) => cap.status === "unknown")).toBe(true);
    expect(effective.unknownRate).toBe(1);
  });
});
