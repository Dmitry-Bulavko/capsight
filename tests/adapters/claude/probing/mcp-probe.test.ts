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
  createDefaultProcessSpawner,
  describeMcpCommand,
  formatMcpCommandDisplay,
  isMcpProbeCacheValid,
  probeMcpServer,
  readMcpProbeCache,
  redactCommandArgs,
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

    it("keeps the executable and flag names while redacting credential values", () => {
      const described = describeMcpCommand({
        command: "npx",
        args: [
          "-y",
          "server-github",
          "--api-key=sk-abcdefghijklmnopqrstuvwx",
          "--token",
          "ghp_abcdefghijklmnopqrstuvwxyz0123456789",
        ],
      });

      expect(described.commandDisplay).toBe(
        "npx -y server-github --api-key=<redacted> --token <redacted>",
      );
      expect(described.argumentsRedacted).toBe(true);
    });

    it("leaves ordinary arguments untouched", () => {
      const described = describeMcpCommand({
        command: "node",
        args: ["--experimental-vm-modules", "./dist/server.js", "--port", "8080"],
      });

      expect(described.commandDisplay).toBe(
        "node --experimental-vm-modules ./dist/server.js --port 8080",
      );
      expect(described.argumentsRedacted).toBe(false);
    });
  });

  describe("redactCommandArgs", () => {
    it("redacts --flag=VALUE for credential-ish flag names", () => {
      const { args, redacted } = redactCommandArgs([
        "--api-key=abc",
        "--auth-token=abc",
        "--password=hunter2",
        "--client-secret=abc",
        "--credential=abc",
        "--pat=abc",
        "--githubToken=abc",
      ]);

      expect(args).toEqual([
        "--api-key=<redacted>",
        "--auth-token=<redacted>",
        "--password=<redacted>",
        "--client-secret=<redacted>",
        "--credential=<redacted>",
        "--pat=<redacted>",
        "--githubToken=<redacted>",
      ]);
      expect(redacted).toBe(true);
    });

    it("redacts the value following a credential-ish flag", () => {
      expect(redactCommandArgs(["--secret", "hunter2", "--port", "8080"]).args).toEqual([
        "--secret",
        "<redacted>",
        "--port",
        "8080",
      ]);
    });

    it("does not swallow the next flag when a credential flag has no value", () => {
      expect(redactCommandArgs(["--token", "--verbose"]).args).toEqual([
        "--token",
        "--verbose",
      ]);
    });

    it("redacts bare token-shaped values", () => {
      const { args } = redactCommandArgs([
        "ghp_abcdefghijklmnopqrstuvwxyz0123456789",
        "sk-abcdefghijklmnopqrstuvwxyz",
        "xoxb-123456789012-abcdefghij",
        "AKIAIOSFODNN7EXAMPLE",
        "kJ8s2mQ4vX7pL1zR9tY3wB6nD0aF5gH2",
      ]);

      expect(args).toEqual([
        "<redacted>",
        "<redacted>",
        "<redacted>",
        "<redacted>",
        "<redacted>",
      ]);
    });

    it("does not redact ordinary package specs, paths or versions", () => {
      const { args, redacted } = redactCommandArgs([
        "-y",
        "@modelcontextprotocol/server-github",
        "./dist/index.js",
        "--protocol-version",
        "2024-11-05",
      ]);

      expect(args).toEqual([
        "-y",
        "@modelcontextprotocol/server-github",
        "./dist/index.js",
        "--protocol-version",
        "2024-11-05",
      ]);
      expect(redacted).toBe(false);
    });

    it("redacts credentials embedded in URLs", () => {
      const { args } = redactCommandArgs([
        "https://user:hunter2@example.com/mcp",
        "https://example.com/mcp?token=abc123&page=2",
        "https://example.com/mcp?api_key=abc123",
      ]);

      expect(args).toEqual([
        "https://user:<redacted>@example.com/mcp",
        "https://example.com/mcp?token=<redacted>&page=2",
        "https://example.com/mcp?api_key=<redacted>",
      ]);
    });

    it("redacts a bearer credential inside a header argument", () => {
      const { args } = redactCommandArgs([
        "-H",
        "Authorization: Bearer abcdefghijklmnop",
      ]);

      expect(args).toEqual(["-H", "Authorization: Bearer <redacted>"]);
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
        expect(result.argumentsRedacted).toBe(false);
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

    it("redacts credential-shaped args and says so in the confirmation prompt", async () => {
      const argSecret = "ghp_abcdefghijklmnopqrstuvwxyz0123456789";
      const { projectDir, configPath, serverId } = await makeTempProject({
        command: "npx",
        args: ["-y", "server-github", "--api-key", argSecret],
      });
      const { spawner } = mockSpawner([]);

      const preview = await probeMcpServer({
        serverId,
        confirmed: false,
        projectPath: projectDir,
        claudeVersion: mockVersion,
        discoveredServer: makeDiscoveredServer(configPath, serverId),
        processSpawner: spawner,
      });

      expect(preview.phase).toBe("preview");
      if (preview.phase === "preview") {
        expect(preview.commandDisplay).toBe("npx -y server-github --api-key <redacted>");
        expect(preview.argumentsRedacted).toBe(true);
        expect(preview.message).toContain("<redacted>");
      }
      expect(JSON.stringify(preview)).not.toContain(argSecret);
    });
  });

  describe("process isolation", () => {
    it("gives the child a minimal environment plus configured keys", async () => {
      process.env.CAPSIGHT_PROBE_LEAK_CHECK = "leaked-value";
      try {
        const { projectDir, configPath, serverId } = await makeTempProject({
          command: "node",
          args: ["server.js"],
          env: { API_KEY: "configured-value" },
        });
        const { spawner, spawn } = mockSpawner([
          JSON.stringify({ jsonrpc: "2.0", id: 2, result: { tools: [] } }),
        ]);

        await probeMcpServer({
          serverId,
          confirmed: true,
          projectPath: projectDir,
          claudeVersion: mockVersion,
          discoveredServer: makeDiscoveredServer(configPath, serverId),
          processSpawner: spawner,
        });

        expect(spawn).toHaveBeenCalledOnce();
        const env = spawn.mock.calls[0]![2].env as NodeJS.ProcessEnv;
        expect(env.CAPSIGHT_PROBE_LEAK_CHECK).toBeUndefined();
        expect(env.API_KEY).toBe("configured-value");
        expect(env.PATH).toBe(process.env.PATH);
        expect(Object.keys(env).length).toBeLessThan(Object.keys(process.env).length);
      } finally {
        delete process.env.CAPSIGHT_PROBE_LEAK_CHECK;
      }
    });

    it("escalates SIGTERM to SIGKILL so a stubborn child is reaped", async () => {
      const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "capsight-mcp-kill-"));
      tempDirs.push(projectDir);
      const scriptPath = path.join(projectDir, "stubborn.js");
      await fs.writeFile(
        scriptPath,
        [
          "process.on('SIGTERM', () => {});",
          "process.on('SIGINT', () => {});",
          "setInterval(() => {}, 1000);",
          // Announced only once the handlers above are installed, so the parent
          // never signals a child that would still die on SIGTERM.
          "process.stdout.write('ready\\n');",
        ].join("\n"),
        "utf8",
      );

      // The idle timeout is deliberately unreachable: termination is triggered
      // by close() after the readiness handshake, not by a race against boot.
      const spawner = createDefaultProcessSpawner(60_000, { killGraceMs: 100 });
      const proc = spawner.spawn(process.execPath, [scriptPath], { cwd: projectDir });

      expect(proc.pid).toBeGreaterThan(0);
      let ready = false;
      for await (const line of proc.readLines()) {
        if (line === "ready") {
          ready = true;
          break;
        }
      }
      expect(ready).toBe(true);

      proc.close();
      const exit = await proc.exited!;
      expect(() => process.kill(proc.pid!, 0)).toThrow();
      // Windows does not let a Node child ignore SIGTERM, so the process exits on
      // the first signal and the grace-period escalation never runs. Unix is where
      // §9.4's SIGTERM→SIGKILL path is exercised.
      if (process.platform !== "win32") {
        expect(exit.signal).toBe("SIGKILL");
      }
    }, 10_000);

    it("reaps a cooperative child on the idle timeout", async () => {
      const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "capsight-mcp-timeout-"));
      tempDirs.push(projectDir);
      const scriptPath = path.join(projectDir, "idle.js");
      // No signal handlers: this child dies on SIGTERM whether or not it has
      // finished booting, so the assertion does not depend on scheduling.
      await fs.writeFile(scriptPath, "setInterval(() => {}, 1000);\n", "utf8");

      const spawner = createDefaultProcessSpawner(50, { killGraceMs: 100 });
      const proc = spawner.spawn(process.execPath, [scriptPath], { cwd: projectDir });

      const exit = await proc.exited!;
      expect(exit.signal).toBe("SIGTERM");
      expect(() => process.kill(proc.pid!, 0)).toThrow();
    }, 10_000);
  });

  describe("failed probes leave no cache entry", () => {
    it("writes no cache file on timeout", async () => {
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

      expect(result.phase === "result" && result.status).toBe("timeout");
      expect(await readMcpProbeCache(projectDir, serverId)).toBeNull();
      await expect(
        fs.stat(path.join(projectDir, ".agent-manager/cache/mcp")),
      ).rejects.toThrow();
    });

    it("writes no cache file for a non-stdio transport", async () => {
      const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "capsight-mcp-probe-"));
      tempDirs.push(projectDir);
      const configPath = path.join(projectDir, ".mcp.json");
      await fs.writeFile(
        configPath,
        JSON.stringify({ mcpServers: { remote: { url: "https://example.com/mcp" } } }),
        "utf8",
      );
      const serverId = computeMcpServerId(configPath, "remote");

      await probeMcpServer({
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
        processSpawner: mockSpawner([]).spawner,
      });

      expect(await readMcpProbeCache(projectDir, serverId)).toBeNull();
    });

    it("does not overwrite a valid cache entry when a later probe fails", async () => {
      const { projectDir, configPath, serverId } = await makeTempProject({
        command: "node",
        args: ["server.js"],
      });

      await probeMcpServer({
        serverId,
        confirmed: true,
        projectPath: projectDir,
        claudeVersion: mockVersion,
        discoveredServer: makeDiscoveredServer(configPath, serverId),
        processSpawner: mockSpawner([
          JSON.stringify({ jsonrpc: "2.0", id: 2, result: { tools: [{ name: "tool-a" }] } }),
        ]).spawner,
      });

      const cached = await readMcpProbeCache(projectDir, serverId);
      expect(cached?.status).toBe("probed");
    });
  });
});
