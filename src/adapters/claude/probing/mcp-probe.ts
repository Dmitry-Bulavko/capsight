import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import type { PlatformVersion } from "../../../core/model/index.js";
import { computeMcpConfigHash, computeMcpServerId } from "../discovery/mcp.js";
import type { DiscoveredMcpServer } from "../discovery/types.js";

const DEFAULT_PROBE_TIMEOUT_MS = 30_000;
/** Grace period between SIGTERM and SIGKILL for a child that ignores termination (§9.4). */
const DEFAULT_KILL_GRACE_MS = 5_000;
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
  /** True when at least one argument value was replaced by `<redacted>` (§0.1.8). */
  argumentsRedacted: boolean;
  requiresConfirmation: true;
}

export interface McpProbeResult {
  phase: "result";
  serverId: string;
  serverName: string;
  commandDisplay: string;
  argumentsRedacted: boolean;
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
  /** Real child processes only; test doubles may omit it. */
  readonly pid?: number;
  /** Resolves once the child has actually exited. Real child processes only. */
  readonly exited?: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
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

export { computeMcpConfigHash };

/**
 * Argument redaction for the confirmation prompt.
 *
 * §7.9 requires showing `Command: <command> <args>` before running a probe, while
 * §0.1.8 / §13 invariant 10 forbid secrets in any output. Resolution: show the
 * command and the argument *shape*, replacing credential-looking values with
 * `<redacted>`. The executable and flag names are never redacted, so the user
 * confirming a probe still sees what is about to run.
 */
const REDACTED = "<redacted>";

const CREDENTIAL_NAME_SUBSTRINGS = [
  "apikey",
  "accesskey",
  "privatekey",
  "secret",
  "password",
  "passwd",
  "credential",
  "token",
  "auth",
];

const CREDENTIAL_NAME_WORDS = new Set(["key", "keys", "pat", "pwd", "cred", "creds"]);

/** Well-known credential prefixes, matched anywhere inside an argument. */
const TOKEN_PREFIX_PATTERN =
  /gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{16,}|sk-[A-Za-z0-9_-]{16,}|xox[abposr]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g;

const BEARER_PATTERN = /\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]{8,}/gi;

const URL_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//;

function splitNameWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

/** True when a flag or query-parameter name looks credential-ish. */
function isCredentialName(rawName: string): boolean {
  const name = rawName.replace(/^-+/, "");
  const compact = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (compact.length === 0) {
    return false;
  }
  if (CREDENTIAL_NAME_SUBSTRINGS.some((needle) => compact.includes(needle))) {
    return true;
  }
  return splitNameWords(name).some((word) => CREDENTIAL_NAME_WORDS.has(word));
}

function shannonEntropy(value: string): number {
  const counts = new Map<string, number>();
  for (const char of value) {
    counts.set(char, (counts.get(char) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / value.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/** Long, high-entropy opaque strings — token-shaped even without a known prefix. */
function looksLikeBareToken(value: string): boolean {
  if (value.length < 24 || !/^[A-Za-z0-9_\-+=.]+$/.test(value)) {
    return false;
  }
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
    return false;
  }
  return shannonEntropy(value) >= 3.5;
}

function hasKnownTokenPrefix(value: string): boolean {
  TOKEN_PREFIX_PATTERN.lastIndex = 0;
  return TOKEN_PREFIX_PATTERN.test(value);
}

/** Redact `user:pass@host` credentials and credential-ish query parameters. */
function redactUrl(value: string): string {
  const withoutUserInfo = value.replace(
    /^([A-Za-z][A-Za-z0-9+.-]*:\/\/)([^/?#\s@]+)@/,
    (_match, scheme: string, userInfo: string) => {
      const separator = userInfo.indexOf(":");
      if (separator >= 0) {
        return `${scheme}${userInfo.slice(0, separator)}:${REDACTED}@`;
      }
      const redactUser = looksLikeBareToken(userInfo) || hasKnownTokenPrefix(userInfo);
      return `${scheme}${redactUser ? REDACTED : userInfo}@`;
    },
  );

  return withoutUserInfo.replace(
    /([?&])([^=&#\s]+)=([^&#\s]*)/g,
    (match, separator: string, name: string, paramValue: string) => {
      const secret =
        isCredentialName(name) ||
        looksLikeBareToken(paramValue) ||
        hasKnownTokenPrefix(paramValue);
      return secret ? `${separator}${name}=${REDACTED}` : match;
    },
  );
}

function redactValue(value: string): string {
  if (URL_PATTERN.test(value)) {
    return redactUrl(value);
  }
  if (looksLikeBareToken(value)) {
    return REDACTED;
  }
  return value.replace(TOKEN_PREFIX_PATTERN, REDACTED).replace(
    BEARER_PATTERN,
    (_match, scheme: string) => `${scheme} ${REDACTED}`,
  );
}

/**
 * Replace credential-shaped argument values with `<redacted>`, keeping flag
 * names, positional shape and the executable intact.
 */
export function redactCommandArgs(args: string[]): { args: string[]; redacted: boolean } {
  const result: string[] = [];
  let redacted = false;
  let expectCredentialValue = false;

  for (const arg of args) {
    if (expectCredentialValue) {
      expectCredentialValue = false;
      if (!arg.startsWith("-")) {
        result.push(REDACTED);
        redacted = true;
        continue;
      }
    }

    const equals = arg.startsWith("-") ? arg.indexOf("=") : -1;
    if (equals > 0) {
      const name = arg.slice(0, equals);
      const value = arg.slice(equals + 1);
      if (isCredentialName(name)) {
        result.push(`${name}=${REDACTED}`);
        redacted = true;
        continue;
      }
      const safeValue = redactValue(value);
      redacted = redacted || safeValue !== value;
      result.push(`${name}=${safeValue}`);
      continue;
    }

    if (arg.startsWith("-") && isCredentialName(arg)) {
      result.push(arg);
      expectCredentialValue = true;
      continue;
    }

    const safeArg = redactValue(arg);
    redacted = redacted || safeArg !== arg;
    result.push(safeArg);
  }

  return { args: result, redacted };
}

export interface McpCommandDescription {
  commandDisplay: string;
  argumentsRedacted: boolean;
}

/** Build the §7.9 `Command: …` line with credential-shaped values redacted. */
export function describeMcpCommand(config: Record<string, unknown>): McpCommandDescription {
  const command = typeof config.command === "string" ? config.command : "";
  const rawArgs = Array.isArray(config.args)
    ? config.args.filter((arg): arg is string => typeof arg === "string")
    : [];
  const { args, redacted } = redactCommandArgs(rawArgs);
  return {
    commandDisplay: [command, ...args].filter(Boolean).join(" "),
    argumentsRedacted: redacted,
  };
}

export function formatMcpCommandDisplay(config: Record<string, unknown>): string {
  return describeMcpCommand(config).commandDisplay;
}

/**
 * Environment keys inherited by the probed child. §9.4 asks for process
 * isolation: the child gets what it needs to start plus the keys the server
 * config declares — never the whole `process.env`.
 */
const INHERITED_ENV_KEYS: readonly string[] =
  process.platform === "win32"
    ? ["PATH", "PATHEXT", "SystemRoot", "COMSPEC", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "TEMP", "TMP"]
    : ["PATH", "HOME"];

function buildSpawnEnv(config: Record<string, unknown>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of INHERITED_ENV_KEYS) {
    const value = process.env[key];
    if (typeof value === "string") {
      env[key] = value;
    }
  }
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
  command: McpCommandDescription,
): McpProbePreview {
  const base = `This starts the MCP server "${serverName}" and runs its initialization logic.`;
  return {
    phase: "preview",
    serverId,
    serverName,
    message: command.argumentsRedacted
      ? `${base} Credential-shaped arguments are shown as ${REDACTED}.`
      : base,
    commandDisplay: command.commandDisplay,
    argumentsRedacted: command.argumentsRedacted,
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

/** Signal the whole child process group when the platform supports it. */
function killChild(child: { pid?: number; kill(signal: NodeJS.Signals): boolean }, signal: NodeJS.Signals): void {
  if (process.platform !== "win32" && child.pid !== undefined) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Group already gone, or no group: fall through to the direct signal.
    }
  }
  try {
    child.kill(signal);
  } catch {
    // Child already exited.
  }
}

/**
 * Default spawner. Isolates the child (own process group where supported) and
 * escalates SIGTERM to SIGKILL after a grace period so a child that ignores
 * termination is still reaped (§9.4).
 */
export function createDefaultProcessSpawner(
  timeoutMs: number,
  options: { killGraceMs?: number } = {},
): ProcessSpawner {
  const killGraceMs = options.killGraceMs ?? DEFAULT_KILL_GRACE_MS;
  return {
    spawn(command, args, spawnOptions) {
      const child = spawn(command, args, {
        cwd: spawnOptions.cwd,
        env: spawnOptions.env,
        stdio: ["pipe", "pipe", "pipe"],
        detached: process.platform !== "win32",
      });

      const lineQueue: string[] = [];
      const waiters: Array<(line: string | null) => void> = [];
      let closed = false;
      let spawnError: Error | null = null;

      const rl = readline.createInterface({ input: child.stdout! });
      rl.on("line", (line) => {
        const waiter = waiters.shift();
        if (waiter) {
          waiter(line);
        } else {
          lineQueue.push(line);
        }
      });

      const finish = () => {
        closed = true;
        for (const waiter of waiters.splice(0)) {
          waiter(null);
        }
      };

      child.on("close", finish);
      child.on("error", (error) => {
        spawnError = error;
        finish();
      });

      const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
        (resolve) => {
          child.on("exit", (code, signal) => {
            resolve({ code, signal });
          });
          child.on("error", () => {
            resolve({ code: null, signal: null });
          });
        },
      );

      let killTimer: NodeJS.Timeout | undefined;
      /** SIGTERM now, SIGKILL after the grace period if the child is still alive. */
      const terminate = () => {
        if (child.exitCode !== null || child.signalCode !== null) {
          return;
        }
        killChild(child, "SIGTERM");
        if (killTimer !== undefined) {
          return;
        }
        killTimer = setTimeout(() => {
          killChild(child, "SIGKILL");
        }, killGraceMs);
      };

      const timer = setTimeout(terminate, timeoutMs);
      child.on("exit", () => {
        clearTimeout(timer);
        if (killTimer !== undefined) {
          clearTimeout(killTimer);
        }
      });

      return {
        pid: child.pid,
        exited,
        write(line: string) {
          child.stdin?.write(`${line}\n`);
        },
        async *readLines() {
          while (!closed || lineQueue.length > 0 || waiters.length > 0) {
            if (spawnError !== null && lineQueue.length === 0) {
              throw spawnError;
            }
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
          child.stdin?.end();
          terminate();
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
    argumentsRedacted: boolean;
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
    argumentsRedacted: input.argumentsRedacted,
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

  const command = describeMcpCommand(resolved.config);
  const commandDisplay = command.commandDisplay;
  const configHash = computeMcpConfigHash(resolved.config);

  if (!input.confirmed) {
    return buildPreview(input.serverId, resolved.name, command);
  }

  const cached = await readMcpProbeCache(input.projectPath, input.serverId);
  if (cached && isMcpProbeCacheValid(cached, configHash)) {
    return buildResult({
      serverId: input.serverId,
      serverName: resolved.name,
      commandDisplay,
      argumentsRedacted: command.argumentsRedacted,
      configHash,
      claudeVersion: input.claudeVersion,
      status: cached.status,
      tools: cached.tools,
      cached: true,
    });
  }

  if (resolved.transport !== "stdio" || !resolved.config.command) {
    // No cache entry: only a successful probe is cacheable (§7.9) — a non-probed
    // status would never satisfy isMcpProbeCacheValid anyway.
    return buildResult({
      serverId: input.serverId,
      serverName: resolved.name,
      commandDisplay,
      argumentsRedacted: command.argumentsRedacted,
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
      argumentsRedacted: command.argumentsRedacted,
      configHash,
      claudeVersion: input.claudeVersion,
      status: "probed",
      tools,
      cached: false,
    });
  } catch (error) {
    const status: McpProbeStatus =
      error instanceof Error && error.message.includes("timeout") ? "timeout" : "error";
    // Failed and timed-out probes leave no cache entry behind in the inspected project.
    return buildResult({
      serverId: input.serverId,
      serverName: resolved.name,
      commandDisplay,
      argumentsRedacted: command.argumentsRedacted,
      configHash,
      claudeVersion: input.claudeVersion,
      status,
      tools: [],
      cached: false,
    });
  }
}
