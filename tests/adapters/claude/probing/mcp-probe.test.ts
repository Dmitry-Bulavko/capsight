import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeMcpConfigHash as computeDiscoveryConfigHash,
  computeMcpServerId,
  resolveMcpServerRef,
} from "../../../../src/adapters/claude/discovery/mcp.js";
import type { DiscoveredMcpServer } from "../../../../src/adapters/claude/discovery/types.js";
import {
  computeMcpConfigHash,
  formatMcpCommandDisplay,
  isMcpProbeCacheValid,
  probeMcpServer,
  readMcpProbeCache,
  type ProcessSpawner,
  type ProbeProcess,
} from "../../../../src/adapters/claude/probing/mcp-probe.js";
import type { PlatformVersion } from "../../../../src/core/model/index.js";

const mockVersion: PlatformVersion = {
  platform: "claude",
  version: "2.1.0",
  raw: "2.1.0",
  detectedAt: "2026-01-01T00:00:00.000Z",
};

async function writeProjectMcpConfig(
  projectDir: string,
  config: Record<string, unknown>,
): Promise<{ configPath: string; serverId: string; serverName: string }> {
  const configPath = path.join(projectDir, ".mcp.json");
  await fs.writeFile(
    configPath,
    JSON.stringify({ mcpServers: { github: config } }, null, 2),
    "utf8",
  );
  return {
    configPath,
    serverId: computeMcpServerId(configPath, "github"),
    serverName: "github",
  };
}

function makeDiscoveredServer(
  configPath: string,
  serverId: string,
  name = "github",
): DiscoveredMcpServer {
  return {
    id: serverId,
    name,
    source: { platform: "claude", scope: "project", path: configPath },
    configPath,
    transport: "stdio",
    definitionKind: "config-file",
    status: "configured",
    configHash: "hash",
  };
}

function mockProbeProcess(lines: string[]): ProbeProcess {
  let index = 0;
  return {
    write: vi.fn(),
    async *readLines() {
      while (index < lines.length) {
        yield lines[index]!;
        index += 1;
      }
    },
    close: vi.fn(),
  };
}

function mockSpawner(lines: string[]): { spawner: ProcessSpawner; spawn: ReturnType<typeof vi.fn> } {
  const spawn = vi.fn(() => mockProbeProcess(lines));
  return {
    spawner: { spawn },
    spawn,
  };
}

describe("mcp-probe", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const dir of tempDirs.splice(0)) {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  async function makeTempProject(config: Record<string, unknown>) {
    const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "capsight-mcp-probe-"));
    tempDirs.push(projectDir);
    const meta = await writeProjectMcpConfig(projectDir, config);
    return { projectDir, ...meta };
  }

  describe("probe addressing", () => {
    const serverA = makeDiscoveredServer("/p/.mcp.json", "id-a", "github");
    const serverB = makeDiscoveredServer("/p/nested/.mcp.json", "id-b", "github");
    const serverC = makeDiscoveredServer("/p/.mcp.json", "id-c", "docs");

    it("resolves a server by its configured name", () => {
      const resolution = resolveMcpServerRef([serverA, serverC], "docs");
      expect(resolution).toEqual({ kind: "found", server: serverC });
    });

    it("still resolves a server by its opaque id", () => {
      const resolution = resolveMcpServerRef([serverA, serverC], "id-a");
      expect(resolution).toEqual({ kind: "found", server: serverA });
    });

    it("reports both candidates when a name is ambiguous across config files", () => {
      const resolution = resolveMcpServerRef([serverA, serverB, serverC], "github");
      expect(resolution.kind).toBe("ambiguous");
      if (resolution.kind === "ambiguous") {
        expect(resolution.candidates).toEqual([serverA, serverB]);
      }
    });

    it("reports not-found for an unknown reference", () => {
      expect(resolveMcpServerRef([serverA], "nope")).toEqual({ kind: "not-found" });
    });
  });

  describe("discovered configHash", () => {
    it("uses the same key-names-only helper as the probe", () => {
      const config = {
        command: "node",
        args: ["server.js"],
        env: { API_KEY: "secret" },
      };
      expect(computeDiscoveryConfigHash(config)).toBe(computeMcpConfigHash(config));
    });
  });

  describe("formatMcpCommandDisplay", () => {
    it("shows command and args without env values", () => {
      const display = formatMcpCommandDisplay({
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
        env: {
          GITHUB_TOKEN: "secret-token-value",
        },
      });

      expect(display).toBe("npx -y @modelcontextprotocol/server-github");
      expect(display).not.toContain("secret-token-value");
      expect(display).not.toContain("GITHUB_TOKEN");
    });
  });

  describe("computeMcpConfigHash", () => {
    it("includes env key names but ignores env values for invalidation", () => {
      const hashA = computeMcpConfigHash({
        command: "node",
        args: ["server.js"],
        env: { API_KEY: "one" },
      });
      const hashB = computeMcpConfigHash({
        command: "node",
        args: ["server.js"],
        env: { API_KEY: "two" },
      });
      const hashC = computeMcpConfigHash({
        command: "node",
        args: ["server.js"],
        env: { OTHER_KEY: "one" },
      });

      expect(hashA).toBe(hashB);
      expect(hashA).not.toBe(hashC);
    });

    it("includes header key names but not header values", () => {
      const hashA = computeMcpConfigHash({
        url: "https://example.com/mcp",
        headers: { Authorization: "Bearer secret-a" },
      });
      const hashB = computeMcpConfigHash({
        url: "https://example.com/mcp",
        headers: { Authorization: "Bearer secret-b" },
      });
      const hashC = computeMcpConfigHash({
        url: "https://example.com/mcp",
        headers: { "X-Api-Key": "secret-a" },
      });

      expect(hashA).toBe(hashB);
      expect(hashA).not.toBe(hashC);
    });
  });

  describe("isMcpProbeCacheValid", () => {
    const probedEntry = {
      serverId: "server-1",
      configHash: "abc123",
      probedAt: "2026-01-01T00:00:00.000Z",
      claudeVersion: "2.1.0",
      status: "probed" as const,
      tools: [{ name: "search" }],
    };

    it("accepts cache when configHash matches and status is probed", () => {
      expect(isMcpProbeCacheValid(probedEntry, "abc123")).toBe(true);
    });

    it("rejects cache when configHash differs", () => {
      expect(isMcpProbeCacheValid(probedEntry, "def456")).toBe(false);
    });

    it("rejects cache when status is not probed even if hash matches", () => {
      expect(
        isMcpProbeCacheValid({ ...probedEntry, status: "timeout" }, "abc123"),
      ).toBe(false);
      expect(
        isMcpProbeCacheValid({ ...probedEntry, status: "error" }, "abc123"),
      ).toBe(false);
      expect(
        isMcpProbeCacheValid({ ...probedEntry, status: "unavailable" }, "abc123"),
      ).toBe(false);
    });
  });

  describe("probeMcpServer confirmation gate", () => {
    it("returns preview without spawning when not confirmed", async () => {
      const { projectDir, configPath, serverId } = await makeTempProject({
        command: "npx",
        args: ["-y", "server"],
      });
      const { spawner, spawn } = mockSpawner([]);

      const result = await probeMcpServer({
        serverId,
        confirmed: false,
        projectPath: projectDir,
        claudeVersion: mockVersion,
        discoveredServer: makeDiscoveredServer(configPath, serverId),
        processSpawner: spawner,
      });

      expect(result.phase).toBe("preview");
      if (result.phase === "preview") {
        expect(result.requiresConfirmation).toBe(true);
        expect(result.message).toContain('MCP server "github"');
        expect(result.commandDisplay).toBe("npx -y server");
      }
      expect(spawn).not.toHaveBeenCalled();
    });

    it("spawns process only when confirmed", async () => {
      const { projectDir, configPath, serverId } = await makeTempProject({
        command: "node",
        args: ["probe-server.js"],
      });
      const { spawner, spawn } = mockSpawner([
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: { protocolVersion: "2024-11-05", capabilities: {} },
        }),
        JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          result: {
            tools: [{ name: "search", description: "Search docs" }],
          },
        }),
      ]);

      const result = await probeMcpServer({
        serverId,
        confirmed: true,
        projectPath: projectDir,
        claudeVersion: mockVersion,
        discoveredServer: makeDiscoveredServer(configPath, serverId),
        processSpawner: spawner,
        timeoutMs: 5000,
      });

      expect(spawn).toHaveBeenCalledOnce();
      expect(result.phase).toBe("result");
      if (result.phase === "result") {
        expect(result.status).toBe("probed");
        expect(result.tools).toEqual([{ name: "search", description: "Search docs" }]);
        expect(result.commandDisplay).toBe("node probe-server.js");
      }
    });
  });

  describe("probeMcpServer cache", () => {
    it("writes cache and reuses it when configHash matches", async () => {
      const { projectDir, configPath, serverId } = await makeTempProject({
        command: "node",
        args: ["server.js"],
      });
      const lines = [
        JSON.stringify({ jsonrpc: "2.0", id: 1, result: { capabilities: {} } }),
        JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          result: { tools: [{ name: "tool-a" }] },
        }),
      ];
      const firstSpawner = mockSpawner(lines);
      const secondSpawner = mockSpawner(lines);

      const first = await probeMcpServer({
        serverId,
        confirmed: true,
        projectPath: projectDir,
        claudeVersion: mockVersion,
        discoveredServer: makeDiscoveredServer(configPath, serverId),
        processSpawner: firstSpawner.spawner,
      });
      const cached = await readMcpProbeCache(projectDir, serverId);

      expect(cached).not.toBeNull();
      expect(isMcpProbeCacheValid(cached!, computeMcpConfigHash({ command: "node", args: ["server.js"] }))).toBe(
        true,
      );

      const second = await probeMcpServer({
        serverId,
        confirmed: true,
        projectPath: projectDir,
        claudeVersion: mockVersion,
        discoveredServer: makeDiscoveredServer(configPath, serverId),
        processSpawner: secondSpawner.spawner,
      });

      expect(firstSpawner.spawn).toHaveBeenCalledOnce();
      expect(secondSpawner.spawn).not.toHaveBeenCalled();
      if (second.phase === "result") {
        expect(second.cached).toBe(true);
        expect(second.tools).toEqual([{ name: "tool-a" }]);
      }
    });

    it("invalidates cache when configHash changes", async () => {
      const { projectDir, configPath, serverId } = await makeTempProject({
        command: "node",
        args: ["v1.js"],
      });
      const firstSpawner = mockSpawner([
        JSON.stringify({ jsonrpc: "2.0", id: 2, result: { tools: [{ name: "old-tool" }] } }),
      ]);

      await probeMcpServer({
        serverId,
        confirmed: true,
        projectPath: projectDir,
        claudeVersion: mockVersion,
        discoveredServer: makeDiscoveredServer(configPath, serverId),
        processSpawner: firstSpawner.spawner,
      });

      await fs.writeFile(
        configPath,
        JSON.stringify(
          {
            mcpServers: {
              github: { command: "node", args: ["v2.js"] },
            },
          },
          null,
          2,
        ),
        "utf8",
      );

      const secondSpawner = mockSpawner([
        JSON.stringify({ jsonrpc: "2.0", id: 2, result: { tools: [{ name: "new-tool" }] } }),
      ]);

      const result = await probeMcpServer({
        serverId,
        confirmed: true,
        projectPath: projectDir,
        claudeVersion: mockVersion,
        discoveredServer: makeDiscoveredServer(configPath, serverId),
        processSpawner: secondSpawner.spawner,
      });

      expect(secondSpawner.spawn).toHaveBeenCalledOnce();
      if (result.phase === "result") {
        expect(result.cached).toBe(false);
        expect(result.tools).toEqual([{ name: "new-tool" }]);
      }
    });

    it("invalidates cache when env keys change", async () => {
      const { projectDir, configPath, serverId } = await makeTempProject({
        command: "node",
        args: ["server.js"],
        env: { API_KEY: "value-a" },
      });
      const firstSpawner = mockSpawner([
        JSON.stringify({ jsonrpc: "2.0", id: 2, result: { tools: [{ name: "cached-tool" }] } }),
      ]);

      await probeMcpServer({
        serverId,
        confirmed: true,
        projectPath: projectDir,
        claudeVersion: mockVersion,
        discoveredServer: makeDiscoveredServer(configPath, serverId),
        processSpawner: firstSpawner.spawner,
      });

      await fs.writeFile(
        configPath,
        JSON.stringify(
          {
            mcpServers: {
              github: {
                command: "node",
                args: ["server.js"],
                env: { OTHER_KEY: "value-b" },
              },
            },
          },
          null,
          2,
        ),
        "utf8",
      );

      const secondSpawner = mockSpawner([
        JSON.stringify({ jsonrpc: "2.0", id: 2, result: { tools: [{ name: "fresh-tool" }] } }),
      ]);

      const result = await probeMcpServer({
        serverId,
        confirmed: true,
        projectPath: projectDir,
        claudeVersion: mockVersion,
        discoveredServer: makeDiscoveredServer(configPath, serverId),
        processSpawner: secondSpawner.spawner,
      });

      expect(secondSpawner.spawn).toHaveBeenCalledOnce();
      if (result.phase === "result") {
        expect(result.cached).toBe(false);
        expect(result.tools).toEqual([{ name: "fresh-tool" }]);
      }
    });
  });

  describe("probeMcpServer transport and timeout", () => {
    it("returns unavailable for non-stdio transport without spawning", async () => {
      const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "capsight-mcp-probe-"));
      tempDirs.push(projectDir);
      const configPath = path.join(projectDir, ".mcp.json");
      await fs.writeFile(
        configPath,
        JSON.stringify({
          mcpServers: {
            remote: { url: "https://example.com/mcp" },
          },
        }),
        "utf8",
      );
      const serverId = computeMcpServerId(configPath, "remote");
      const { spawner, spawn } = mockSpawner([]);

      const result = await probeMcpServer({
        serverId,
        confirmed: true,
        projectPath: projectDir,
        claudeVersion: mockVersion,
        discoveredServer: {
          id: serverId,
          name: "remote",
          source: { platform: "claude", scope: "project", path: configPath },
          configPath,
          transport: "http",
          definitionKind: "config-file",
          status: "configured",
          configHash: "hash",
        },
        processSpawner: spawner,
      });

      expect(spawn).not.toHaveBeenCalled();
      if (result.phase === "result") {
        expect(result.status).toBe("unavailable");
      }
    });

    it("returns timeout status when probe exceeds timeout", async () => {
      const { projectDir, configPath, serverId } = await makeTempProject({
        command: "node",
        args: ["slow-server.js"],
      });
      const spawner: ProcessSpawner = {
        spawn: vi.fn(() => ({
          write: vi.fn(),
          async *readLines() {
            await new Promise((resolve) => setTimeout(resolve, 50));
          },
          close: vi.fn(),
        })),
      };

      const result = await probeMcpServer({
        serverId,
        confirmed: true,
        projectPath: projectDir,
        claudeVersion: mockVersion,
        discoveredServer: makeDiscoveredServer(configPath, serverId),
        processSpawner: spawner,
        timeoutMs: 10,
      });

      if (result.phase === "result") {
        expect(result.status).toBe("timeout");
        expect(result.tools).toEqual([]);
      }
    });
  });

  describe("secrets in output", () => {
    it("never includes env values in preview or result payloads", async () => {
      const secret = "super-secret-token-12345";
      const { projectDir, configPath, serverId } = await makeTempProject({
        command: "node",
        args: ["server.js"],
        env: { GITHUB_TOKEN: secret },
        headers: { Authorization: "Bearer also-secret" },
      });
      const { spawner } = mockSpawner([
        JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          result: { tools: [{ name: "merge", description: "Merge PR" }] },
        }),
      ]);

      const preview = await probeMcpServer({
        serverId,
        confirmed: false,
        projectPath: projectDir,
        claudeVersion: mockVersion,
        discoveredServer: makeDiscoveredServer(configPath, serverId),
        processSpawner: spawner,
      });
      const result = await probeMcpServer({
        serverId,
        confirmed: true,
        projectPath: projectDir,
        claudeVersion: mockVersion,
        discoveredServer: makeDiscoveredServer(configPath, serverId),
        processSpawner: spawner,
      });

      const serialized = JSON.stringify({ preview, result });
      expect(serialized).not.toContain(secret);
      expect(serialized).not.toContain("also-secret");
      expect(serialized).not.toContain("GITHUB_TOKEN");
      expect(serialized).not.toContain("Authorization");
    });
  });
});
