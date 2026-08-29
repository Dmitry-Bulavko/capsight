import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  McpProbeResponse,
  McpProbeStatus,
} from "../../src/adapters/claude/probing/mcp-probe.js";
import type { LocalStateWarning } from "../../src/core/warnings/local-state.js";

const probeMcpServer = vi.fn<(input: { projectPath: string }) => Promise<McpProbeResponse>>();

vi.mock("../../src/adapters/claude/probing/mcp-probe.js", () => ({
  probeMcpServer: (input: { projectPath: string }) => probeMcpServer(input),
}));

const { probeMcp } = await import("../../src/application/probe-mcp.js");
const { resetLocalStateNotices } = await import("../../src/application/local-state-notice.js");
const { clearLastScan } = await import("../../src/application/scan-store.js");

const CACHE_DIR = path.join(".agent-manager", "cache", "mcp");
const tempDirs: string[] = [];

beforeEach(() => {
  probeMcpServer.mockReset();
  resetLocalStateNotices();
  clearLastScan();
});

afterEach(async () => {
  resetLocalStateNotices();
  clearLastScan();
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

/** A temp git repository with one stdio MCP server configured. */
async function makeTempProject(): Promise<string> {
  const created = await fs.mkdtemp(path.join(os.tmpdir(), "capsight-local-state-probe-"));
  tempDirs.push(created);
  const dir = await fs.realpath(created);
  await fs.mkdir(path.join(dir, ".git", "info"), { recursive: true });
  await fs.mkdir(path.join(dir, ".claude"), { recursive: true });
  await fs.writeFile(
    path.join(dir, ".mcp.json"),
    JSON.stringify(
      { mcpServers: { github: { command: "node", args: ["server.js"] } } },
      null,
      2,
    ),
    "utf8",
  );
  return dir;
}

/** Stand in for the adapter, writing a cache entry only when a fresh probe succeeds. */
function stubProbe(status: McpProbeStatus, cached = false): void {
  probeMcpServer.mockImplementation(async (input) => {
    if (status === "probed" && !cached) {
      const cacheDir = path.join(input.projectPath, CACHE_DIR);
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(path.join(cacheDir, "server-id.json"), "{}", "utf8");
    }
    return {
      phase: "result",
      serverId: "server-id",
      serverName: "github",
      commandDisplay: "node server.js",
      argumentsRedacted: false,
      configHash: "hash",
      probedAt: "2026-01-01T00:00:00.000Z",
      claudeVersion: "2.1.0",
      status,
      tools: [],
      cached,
    };
  });
}

async function probe(projectPath: string): Promise<McpProbeResponse> {
  return probeMcp({ serverId: "github", confirmed: true, projectPath });
}

function warningOf(response: McpProbeResponse): LocalStateWarning | undefined {
  return response.phase === "result" ? response.localStateWarning : undefined;
}

describe("probeMcp() local-state warning", () => {
  it("warns on the successful probe that writes the first cache entry", async () => {
    const projectPath = await makeTempProject();
    stubProbe("probed");

    const response = await probe(projectPath);

    expect(response.phase).toBe("result");
    expect(warningOf(response)).toBeDefined();
    expect(warningOf(response)!.directory).toBe(path.join(projectPath, ".agent-manager"));
    expect(warningOf(response)!.message).toContain(".agent-manager/");
  });

  it("does not warn when a failed probe writes nothing", async () => {
    const projectPath = await makeTempProject();
    stubProbe("error");

    expect(warningOf(await probe(projectPath))).toBeUndefined();
    // Nothing was written, so a later successful probe is still the first write.
    await expect(fs.stat(path.join(projectPath, ".agent-manager"))).rejects.toThrow();

    clearLastScan();
    stubProbe("probed");
    expect(warningOf(await probe(projectPath))).toBeDefined();
  });

  it("does not warn when a timed-out or unavailable probe writes nothing", async () => {
    for (const status of ["timeout", "unavailable"] as const) {
      const projectPath = await makeTempProject();
      clearLastScan();
      stubProbe(status);

      expect(warningOf(await probe(projectPath))).toBeUndefined();
      await expect(fs.stat(path.join(projectPath, ".agent-manager"))).rejects.toThrow();
    }
  });

  it("does not warn when the result came from the cache", async () => {
    const projectPath = await makeTempProject();
    stubProbe("probed", true);

    expect(warningOf(await probe(projectPath))).toBeUndefined();
  });

  it("does not warn on an unconfirmed preview", async () => {
    const projectPath = await makeTempProject();
    probeMcpServer.mockResolvedValue({
      phase: "preview",
      serverId: "server-id",
      serverName: "github",
      commandDisplay: "node server.js",
      argumentsRedacted: false,
      requiresConfirmation: true,
      message: "Confirm to probe",
    });

    const response = await probeMcp({
      serverId: "github",
      confirmed: false,
      projectPath,
    });

    expect(response.phase).toBe("preview");
    expect(warningOf(response)).toBeUndefined();
  });

  it("does not repeat the warning on a second successful probe", async () => {
    const projectPath = await makeTempProject();
    stubProbe("probed");

    expect(warningOf(await probe(projectPath))).toBeDefined();
    clearLastScan();
    expect(warningOf(await probe(projectPath))).toBeUndefined();
  });

  it("stays silent when .gitignore already covers the directory", async () => {
    const projectPath = await makeTempProject();
    await fs.writeFile(path.join(projectPath, ".gitignore"), ".agent-manager/\n", "utf8");
    stubProbe("probed");

    expect(warningOf(await probe(projectPath))).toBeUndefined();
  });
});
