import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import type { PlatformVersion } from "../../../core/model/index.js";
import { computeMcpServerId } from "../discovery/mcp.js";
import type { DiscoveredMcpServer } from "../discovery/types.js";

const DEFAULT_PROBE_TIMEOUT_MS = 30_000;
const CACHE_DIR = ".agent-manager/cache/mcp";

export type McpProbeStatus = "probed" | "unavailable" | "timeout" | "error";

export interface McpProbeTool {
  name: string;
  description?: string;
}

export interface McpProbeCacheEntry {
  serverId: string;
  configHash: string;
  probedAt: string;
  claudeVersion: string;
  status: McpProbeStatus;
  tools: McpProbeTool[];
}

export interface McpProbePreview {
  phase: "preview";
  serverId: string;
  serverName: string;
  message: string;
  commandDisplay: string;
  requiresConfirmation: true;
}

export interface McpProbeResult {
  phase: "result";
  serverId: string;
  serverName: string;
  commandDisplay: string;
  configHash: string;
  probedAt: string;
  claudeVersion: string;
  status: McpProbeStatus;
  tools: McpProbeTool[];
  cached: boolean;
}

export type McpProbeResponse = McpProbePreview | McpProbeResult;

export interface ProbeProcess {
  write(line: string): void;
  readLines(): AsyncIterable<string>;
  close(): void;
}

export interface ProcessSpawner {
  spawn(
    command: string,
    args: string[],
    options: { cwd?: string; env?: NodeJS.ProcessEnv },
  ): ProbeProcess;
}

export interface ProbeMcpServerInput {
  serverId: string;
  confirmed: boolean;
  projectPath: string;
  claudeVersion: PlatformVersion;
  discoveredServer: DiscoveredMcpServer;
  processSpawner?: ProcessSpawner;
  timeoutMs?: number;
}

interface ResolvedMcpConfig {
  name: string;
  config: Record<string, unknown>;
  transport: DiscoveredMcpServer["transport"];
}

async function readJsonFile(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function resolveMcpServerConfig(
  configPath: string,
  serverId: string,
): Promise<ResolvedMcpConfig | null> {
  const json = await readJsonFile(configPath);
  if (!json) {
    return null;
  }

  const mcpServers =
    json.mcpServers && typeof json.mcpServers === "object" && !Array.isArray(json.mcpServers)
      ? (json.mcpServers as Record<string, Record<string, unknown>>)
      : json;

  for (const [name, config] of Object.entries(mcpServers)) {
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      continue;
    }
    if (computeMcpServerId(configPath, name) === serverId) {
      const serverConfig = config as Record<string, unknown>;
      let transport: DiscoveredMcpServer["transport"] = "unknown";
      if (typeof serverConfig.command === "string") {
        transport = "stdio";
      } else if (typeof serverConfig.url === "string") {
        const url = serverConfig.url.toLowerCase();
        if (url.includes("sse")) {
          transport = "sse";
        } else if (url.startsWith("ws")) {
          transport = "ws";
        } else {
          transport = "http";
        }
      }
      return { name, config: serverConfig, transport };
    }
  }

  return null;
}

function sortedKeys(value: unknown): string[] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return Object.keys(value).sort();
}

export function computeMcpConfigHash(config: Record<string, unknown>): string {
  const hashInput = {
    command: config.command,
    args: config.args,
    url: config.url,
    type: config.type,
    envKeys: sortedKeys(config.env),
    headerKeys: sortedKeys(config.headers),
  };
  return createHash("sha256").update(JSON.stringify(hashInput)).digest("hex").slice(0, 16);
}

export function formatMcpCommandDisplay(config: Record<string, unknown>): string {
  const command = typeof config.command === "string" ? config.command : "";
  const args = Array.isArray(config.args)
    ? config.args.filter((arg): arg is string => typeof arg === "string")
    : [];
  return [command, ...args].filter(Boolean).join(" ");
}

function buildSpawnEnv(config: Record<string, unknown>): NodeJS.ProcessEnv {
  const env = { ...process.env };
  if (config.env && typeof config.env === "object" && !Array.isArray(config.env)) {
    for (const [key, value] of Object.entries(config.env)) {
      if (typeof value === "string") {
        env[key] = value;
      }
    }
  }
  return env;
}

function buildPreview(
  serverId: string,
  serverName: string,
  commandDisplay: string,
): McpProbePreview {
  return {
    phase: "preview",
    serverId,
    serverName,
    message: `This starts the MCP server "${serverName}" and runs its initialization logic.`,
    commandDisplay,
    requiresConfirmation: true,
  };
}

function probeCachePath(projectPath: string, serverId: string): string {
  return path.join(projectPath, CACHE_DIR, `${serverId}.json`);
}

export async function readMcpProbeCache(
  projectPath: string,
  serverId: string,
): Promise<McpProbeCacheEntry | null> {
  try {
    const raw = await fs.readFile(probeCachePath(projectPath, serverId), "utf8");
    const parsed = JSON.parse(raw) as McpProbeCacheEntry;
    if (parsed.serverId !== serverId || typeof parsed.configHash !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function writeMcpProbeCache(
  projectPath: string,
  entry: McpProbeCacheEntry,
): Promise<void> {
  const cachePath = probeCachePath(projectPath, entry.serverId);
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify(entry, null, 2), "utf8");
}

export function isMcpProbeCacheValid(
  cache: McpProbeCacheEntry,
  configHash: string,
): boolean {
  return cache.configHash === configHash && cache.status === "probed";
}

function createDefaultProcessSpawner(timeoutMs: number): ProcessSpawner {
  return {
    spawn(command, args, options) {
      const child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env,
        stdio: ["pipe", "pipe", "pipe"],
      });

      const lineQueue: string[] = [];
      const waiters: Array<(line: string | null) => void> = [];
      let closed = false;

      const rl = readline.createInterface({ input: child.stdout! });
      rl.on("line", (line) => {
        const waiter = waiters.shift();
        if (waiter) {
          waiter(line);
        } else {
          lineQueue.push(line);
        }
      });

      child.on("close", () => {
        closed = true;
        for (const waiter of waiters.splice(0)) {
          waiter(null);
        }
      });

      const timer = setTimeout(() => {
        child.kill("SIGTERM");
      }, timeoutMs);

      return {
        write(line: string) {
          child.stdin?.write(`${line}\n`);
        },
        async *readLines() {
          while (!closed || lineQueue.length > 0 || waiters.length > 0) {
            if (lineQueue.length > 0) {
              yield lineQueue.shift()!;
              continue;
            }
            if (closed) {
              break;
            }
            const line = await new Promise<string | null>((resolve) => {
              waiters.push(resolve);
            });
            if (line === null) {
              break;
            }
            yield line;
          }
        },
        close() {
          clearTimeout(timer);
          child.kill("SIGTERM");
          child.stdin?.end();
        },
      };
    },
  };
}

async function listMcpTools(
  config: Record<string, unknown>,
  spawner: ProcessSpawner,
  timeoutMs: number,
  cwd: string,
): Promise<McpProbeTool[]> {
  const command = typeof config.command === "string" ? config.command : "";
  const args = Array.isArray(config.args)
    ? config.args.filter((arg): arg is string => typeof arg === "string")
    : [];
  if (!command) {
    return [];
  }

  const proc = spawner.spawn(command, args, {
    cwd,
    env: buildSpawnEnv(config),
  });

  const responses: Array<{ id?: number; result?: { tools?: McpProbeTool[] } }> = [];
  const readTask = (async () => {
    for await (const line of proc.readLines()) {
      try {
        responses.push(JSON.parse(line) as { id?: number; result?: { tools?: McpProbeTool[] } });
      } catch {
        // Ignore non-JSON noise from server stderr/stdout.
      }
    }
  })();

  proc.write(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "capsight", version: "0.0.0" },
      },
    }),
  );
  proc.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }));
  proc.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }));

  await Promise.race([
    readTask,
    new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error("probe timeout")), timeoutMs);
    }),
  ]).finally(() => {
    proc.close();
  });

  const toolsResponse = responses.find((response) => response.id === 2);
  return toolsResponse?.result?.tools?.map((tool) => ({
    name: tool.name,
    description: tool.description,
  })) ?? [];
}

function buildResult(
  input: {
    serverId: string;
    serverName: string;
    commandDisplay: string;
    configHash: string;
    claudeVersion: PlatformVersion;
    status: McpProbeStatus;
    tools: McpProbeTool[];
    cached: boolean;
  },
): McpProbeResult {
  return {
    phase: "result",
    serverId: input.serverId,
    serverName: input.serverName,
    commandDisplay: input.commandDisplay,
    configHash: input.configHash,
    probedAt: new Date().toISOString(),
    claudeVersion: input.claudeVersion.version,
    status: input.status,
    tools: input.tools,
    cached: input.cached,
  };
}

export async function probeMcpServer(input: ProbeMcpServerInput): Promise<McpProbeResponse> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const resolved = await resolveMcpServerConfig(
    input.discoveredServer.configPath,
    input.serverId,
  );

  if (!resolved) {
    throw new Error(`MCP server configuration not found: ${input.serverId}`);
  }

  const commandDisplay = formatMcpCommandDisplay(resolved.config);
  const configHash = computeMcpConfigHash(resolved.config);

  if (!input.confirmed) {
    return buildPreview(input.serverId, resolved.name, commandDisplay);
  }

  const cached = await readMcpProbeCache(input.projectPath, input.serverId);
  if (cached && isMcpProbeCacheValid(cached, configHash)) {
    return buildResult({
      serverId: input.serverId,
      serverName: resolved.name,
      commandDisplay,
      configHash,
      claudeVersion: input.claudeVersion,
      status: cached.status,
      tools: cached.tools,
      cached: true,
    });
  }

  if (resolved.transport !== "stdio" || !resolved.config.command) {
    const entry: McpProbeCacheEntry = {
      serverId: input.serverId,
      configHash,
      probedAt: new Date().toISOString(),
      claudeVersion: input.claudeVersion.version,
      status: "unavailable",
      tools: [],
    };
    await writeMcpProbeCache(input.projectPath, entry);
    return buildResult({
      serverId: input.serverId,
      serverName: resolved.name,
      commandDisplay,
      configHash,
      claudeVersion: input.claudeVersion,
      status: "unavailable",
      tools: [],
      cached: false,
    });
  }

  const spawner = input.processSpawner ?? createDefaultProcessSpawner(timeoutMs);

  try {
    const tools = await listMcpTools(
      resolved.config,
      spawner,
      timeoutMs,
      input.projectPath,
    );
    const entry: McpProbeCacheEntry = {
      serverId: input.serverId,
      configHash,
      probedAt: new Date().toISOString(),
      claudeVersion: input.claudeVersion.version,
      status: "probed",
      tools,
    };
    await writeMcpProbeCache(input.projectPath, entry);
    return buildResult({
      serverId: input.serverId,
      serverName: resolved.name,
      commandDisplay,
      configHash,
      claudeVersion: input.claudeVersion,
      status: "probed",
      tools,
      cached: false,
    });
  } catch (error) {
    const status: McpProbeStatus =
      error instanceof Error && error.message.includes("timeout") ? "timeout" : "error";
    const entry: McpProbeCacheEntry = {
      serverId: input.serverId,
      configHash,
      probedAt: new Date().toISOString(),
      claudeVersion: input.claudeVersion.version,
      status,
      tools: [],
    };
    await writeMcpProbeCache(input.projectPath, entry);
    return buildResult({
      serverId: input.serverId,
      serverName: resolved.name,
      commandDisplay,
      configHash,
      claudeVersion: input.claudeVersion,
      status,
      tools: [],
      cached: false,
    });
  }
}
