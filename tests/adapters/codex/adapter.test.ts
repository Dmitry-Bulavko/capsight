import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformVersion } from "../../../src/core/model/index.js";
import { scan } from "../../../src/application/scan.js";
import { resolve } from "../../../src/application/resolve.js";
import { buildExecutionContext } from "../../../src/adapters/codex/resolution/context.js";
import { fixtureHomeDir } from "../../fixtures/fixture-runtime.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const basicFixture = path.join(__dirname, "../../fixtures/codex/basic/project");

const { mockDetectCodexVersion } = vi.hoisted(() => ({
  mockDetectCodexVersion: vi.fn<() => Promise<PlatformVersion>>(),
}));

vi.mock("../../../src/adapters/codex/version/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/adapters/codex/version/index.js")>();
  return {
    ...actual,
    detectCodexVersion: mockDetectCodexVersion,
    defaultCommandRunner: { run: vi.fn() },
  };
});

describe("codex adapter", () => {
  afterEach(() => {
    mockDetectCodexVersion.mockReset();
    vi.unstubAllEnvs();
  });

  it("scans codex fixture project", async () => {
    const home = fixtureHomeDir();
    vi.stubEnv("HOME", home);
    vi.stubEnv("USERPROFILE", home);
    vi.stubEnv("CODEX_HOME", path.join(home, ".codex"));

    mockDetectCodexVersion.mockResolvedValue({
      platform: "codex",
      version: "0.130.0",
      raw: "codex-cli 0.130.0",
      detectedAt: "1970-01-01T00:00:00.000Z",
    });

    const result = await scan({ projectPath: basicFixture, platform: "codex" });

    expect(result.platform).toBe("codex");
    expect(result.snapshot.version.platform).toBe("codex");
    expect(result.snapshot.agents.some((a) => a.name === "main" && a.status === "active")).toBe(
      true,
    );
    expect(result.snapshot.skills.length).toBeGreaterThan(0);
    expect(result.snapshot.instructions.length).toBeGreaterThan(0);
    expect(result.snapshot.mcpServers.length).toBeGreaterThan(0);
    expect(result.snapshot.settings.length).toBeGreaterThan(0);
    expect(result.snapshot.trust.accepted).toBe("unknown");
  });

  it("resolveEffective returns mostly unknown capabilities", async () => {
    const home = fixtureHomeDir();
    vi.stubEnv("HOME", home);
    vi.stubEnv("USERPROFILE", home);
    vi.stubEnv("CODEX_HOME", path.join(home, ".codex"));

    mockDetectCodexVersion.mockResolvedValue({
      platform: "codex",
      version: "0.130.0",
      raw: "codex-cli 0.130.0",
      detectedAt: "1970-01-01T00:00:00.000Z",
    });

    const scanResult = await scan({ projectPath: basicFixture, platform: "codex" });
    const agent = scanResult.snapshot.agents.find(
      (entry) => entry.name === "main" && entry.status === "active",
    );
    expect(agent).toBeDefined();

    const effective = await resolve({
      snapshot: scanResult.snapshot,
      agentId: agent!.id,
      context: buildExecutionContext("main-session"),
    });

    expect(effective.capabilities.length).toBeGreaterThan(0);
    expect(effective.capabilities.every((cap) => cap.status === "unknown")).toBe(true);
    expect(effective.unknownRate).toBe(1);
  });
});
