import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformId } from "../../src/adapters/platform.js";
import { detectPlatforms } from "../../src/application/detect-platforms.js";
import {
  clearLastScan,
  getLastScan,
  scanAndStore,
} from "../../src/application/scan-store.js";
import type { ScanOptions, ScanResult } from "../../src/application/scan.js";

vi.mock("../../src/application/scan.js", () => ({
  scan: vi.fn(),
}));

import { scan } from "../../src/application/scan.js";

const mockScan = vi.mocked(scan);

function mockScanResult(projectPath: string, platform: PlatformId): ScanResult {
  return {
    platform,
    status: "complete",
    snapshot: {
      id: `${platform}-snapshot`,
      projectPath,
      version: {
        platform,
        version: "1.0.0",
        raw: "1.0.0",
        detectedAt: "2026-01-01T00:00:00.000Z",
      },
      environment: { relevant: [] },
      trust: { accepted: true, projectPath },
      agents: [],
      skills: [],
      instructions: [],
      mcpServers: [],
      settings: [],
      warnings: [],
      scannedAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

const tempDirs: string[] = [];

beforeEach(() => {
  clearLastScan();
  mockScan.mockReset();
});

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function makeTempProject(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "capsight-detect-"));
  tempDirs.push(dir);
  return dir;
}

describe("detectPlatforms()", () => {
  it("returns all three platforms with detected or not-detected status", async () => {
    const projectPath = await makeTempProject();
    const detection = await detectPlatforms(projectPath);

    expect(detection).toHaveLength(3);
    expect(detection.map((entry) => entry.platform).sort()).toEqual([
      "claude",
      "codex",
      "cursor",
    ]);
    for (const entry of detection) {
      expect(["detected", "not-detected"]).toContain(entry.status);
      expect(Array.isArray(entry.evidence)).toBe(true);
    }
  });

  it("detects Cursor and Codex when only AGENTS.md is present", async () => {
    const projectPath = await makeTempProject();
    const agentsMd = path.join(projectPath, "AGENTS.md");
    await fs.writeFile(agentsMd, "# Project agents\n");

    const detection = await detectPlatforms(projectPath);
    const byPlatform = Object.fromEntries(detection.map((entry) => [entry.platform, entry]));

    expect(byPlatform.claude?.status).toBe("not-detected");
    expect(byPlatform.cursor?.status).toBe("detected");
    expect(byPlatform.codex?.status).toBe("detected");

    expect(byPlatform.cursor?.evidence).toEqual([
      expect.objectContaining({
        platform: "cursor",
        path: agentsMd,
        scope: "project",
        matrixRef: "instruction@AGENTS.md",
      }),
    ]);
    expect(byPlatform.codex?.evidence).toEqual([
      expect.objectContaining({
        platform: "codex",
        path: agentsMd,
        scope: "project",
        matrixRef: "instruction@AGENTS.md",
      }),
    ]);
  });

  it("detects Claude from .claude/agents markdown without a .claude-only directory heuristic", async () => {
    const projectPath = await makeTempProject();
    const agentsDir = path.join(projectPath, ".claude", "agents");
    await fs.mkdir(agentsDir, { recursive: true });
    await fs.writeFile(
      path.join(agentsDir, "backend.md"),
      "---\nname: backend\ndescription: Backend\n---\n",
    );

    const detection = await detectPlatforms(projectPath);
    const claude = detection.find((entry) => entry.platform === "claude");

    expect(claude?.status).toBe("detected");
    expect(claude?.evidence).toEqual([
      expect.objectContaining({
        platform: "claude",
        matrixRef: "agent@markdown",
        scope: "project",
      }),
    ]);
  });

  it("does not detect Claude from AGENTS.md alone", async () => {
    const projectPath = await makeTempProject();
    await fs.writeFile(path.join(projectPath, "AGENTS.md"), "# Agents\n");

    const detection = await detectPlatforms(projectPath);
    const claude = detection.find((entry) => entry.platform === "claude");

    expect(claude?.status).toBe("not-detected");
    expect(claude?.evidence).toEqual([]);
  });

  it("includes evidence paths behind each detected verdict", async () => {
    const projectPath = await makeTempProject();
    await fs.mkdir(path.join(projectPath, ".cursor", "rules"), { recursive: true });
    const rulePath = path.join(projectPath, ".cursor", "rules", "style.mdc");
    await fs.writeFile(rulePath, "---\nalwaysApply: true\n---\n");

    const detection = await detectPlatforms(projectPath);
    const cursor = detection.find((entry) => entry.platform === "cursor");

    expect(cursor?.status).toBe("detected");
    expect(cursor?.evidence).toEqual([
      expect.objectContaining({
        platform: "cursor",
        path: rulePath,
        matrixRef: "instruction@rule-mdc",
      }),
    ]);
  });
});

describe("scanAndStore() with detection", () => {
  it("scans detected platforms plus the active default when not detected", async () => {
    const projectPath = await makeTempProject();
    await fs.writeFile(path.join(projectPath, "AGENTS.md"), "# Agents\n");

    mockScan.mockImplementation(async ({ platform }: ScanOptions) =>
      mockScanResult(projectPath, platform ?? "claude"),
    );

    const result = await scanAndStore(projectPath);

    expect(mockScan).toHaveBeenCalledTimes(3);
    expect(mockScan).toHaveBeenCalledWith({ projectPath, platform: "cursor" });
    expect(mockScan).toHaveBeenCalledWith({ projectPath, platform: "codex" });
    expect(mockScan).toHaveBeenCalledWith({ projectPath, platform: "claude" });
    expect(result.platform).toBe("claude");
    expect(getLastScan()?.platform).toBe("claude");
  });

  it("scans Claude on an empty project with no detected platforms", async () => {
    const projectPath = await makeTempProject();

    mockScan.mockImplementation(async ({ platform }: ScanOptions) =>
      mockScanResult(projectPath, platform ?? "claude"),
    );

    const result = await scanAndStore(projectPath);

    expect(mockScan).toHaveBeenCalledTimes(1);
    expect(mockScan).toHaveBeenCalledWith({ projectPath, platform: "claude" });
    expect(result.platform).toBe("claude");
    expect(getLastScan()?.platform).toBe("claude");
  });

  it("honors an explicit platform request even when not detected", async () => {
    const projectPath = await makeTempProject();
    await fs.writeFile(path.join(projectPath, "AGENTS.md"), "# Agents\n");

    mockScan.mockImplementation(async ({ platform }: ScanOptions) =>
      mockScanResult(projectPath, platform ?? "claude"),
    );

    const result = await scanAndStore(projectPath, "claude");

    expect(result.platform).toBe("claude");
    expect(getLastScan()?.platform).toBe("claude");
    expect(mockScan).toHaveBeenCalledWith({ projectPath, platform: "claude" });
  });
});
