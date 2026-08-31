import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  InvalidObserveFixtureError,
  OBSERVE_DISCLAIMER,
  runObserve,
  validateObserveFixturePath,
} from "../../src/cli/commands/observe.js";

const repoRoot = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../..",
);
const basicFixture = path.join(repoRoot, "tests/fixtures/claude/basic/project");

vi.mock("../../src/adapters/claude/probing/agent-sdk-spike.js", () => ({
  probeAgentSdkToolPool: vi.fn(),
}));

import { probeAgentSdkToolPool } from "../../src/adapters/claude/probing/agent-sdk-spike.js";

const mockProbe = vi.mocked(probeAgentSdkToolPool);

const sampleProbeResult = {
  fixtureCwd: basicFixture,
  attemptedApis: ["mcpServerStatus", "streamInitTools"],
  mcpServerStatus: null,
  contextUsage: null,
  initialization: null,
  initStreamTools: { toolNames: ["Read", "Grep"] },
  notes: [],
};

describe("observe CLI (dev-only)", () => {
  beforeEach(() => {
    mockProbe.mockReset();
    mockProbe.mockResolvedValue(sampleProbeResult);
  });

  describe("validateObserveFixturePath", () => {
    it("accepts paths under tests/fixtures/claude/", () => {
      const resolved = validateObserveFixturePath("tests/fixtures/claude/basic/project");
      expect(resolved.replace(/\\/g, "/")).toContain("/tests/fixtures/claude/basic/project");
    });

    it("accepts absolute paths under tests/fixtures/claude/", () => {
      const resolved = validateObserveFixturePath(basicFixture);
      expect(resolved).toBe(path.resolve(basicFixture));
    });

    it("rejects user project paths outside the Claude fixture corpus", () => {
      expect(() => validateObserveFixturePath("/tmp/my-project")).toThrow(
        InvalidObserveFixtureError,
      );
      expect(() => validateObserveFixturePath(process.cwd())).toThrow(
        InvalidObserveFixtureError,
      );
    });

    it("rejects other fixture corpora (codex, cursor, ecosystem)", () => {
      expect(() =>
        validateObserveFixturePath("tests/fixtures/codex/basic/project"),
      ).toThrow(InvalidObserveFixtureError);
      expect(() =>
        validateObserveFixturePath("tests/fixtures/cursor/basic/project"),
      ).toThrow(InvalidObserveFixtureError);
      expect(() =>
        validateObserveFixturePath("tests/fixtures/ecosystem/mixed/project"),
      ).toThrow(InvalidObserveFixtureError);
    });
  });

  describe("runObserve", () => {
    it("runs the Agent SDK probe harness and returns JSON-shaped observations", async () => {
      const result = await runObserve(basicFixture);

      expect(mockProbe).toHaveBeenCalledWith(path.resolve(basicFixture));
      expect(result).toEqual({
        mode: "dev-only",
        fixturePath: path.resolve(basicFixture),
        disclaimer: OBSERVE_DISCLAIMER,
        capabilities: [],
        agentSdkProbe: sampleProbeResult,
      });
    });

    it("rejects non-fixture paths before invoking the probe harness", async () => {
      await expect(runObserve("/tmp/user-project")).rejects.toThrow(InvalidObserveFixtureError);
      expect(mockProbe).not.toHaveBeenCalled();
    });
  });

  describe("dev-only guard — not on scan path", () => {
    it("scan application module does not import observe or probe harness", async () => {
      const scanSource = await readFile(
        path.join(repoRoot, "src/application/scan.ts"),
        "utf8",
      );
      const scanStoreSource = await readFile(
        path.join(repoRoot, "src/application/scan-store.ts"),
        "utf8",
      );

      for (const source of [scanSource, scanStoreSource]) {
        expect(source).not.toMatch(/runObserve|observe\.ts/);
        expect(source).not.toMatch(/probeAgentSdkToolPool|agent-sdk-spike/);
      }
    });

    it("observe command is registered separately from scan in the CLI", async () => {
      const cliSource = await readFile(path.join(repoRoot, "src/cli/index.ts"), "utf8");
      expect(cliSource).toMatch(/\.command\("observe"\)/);
      expect(cliSource).toMatch(/runObserve/);
      expect(cliSource).not.toMatch(/runScan[\s\S]*probeAgentSdkToolPool/);
    });
  });
});
