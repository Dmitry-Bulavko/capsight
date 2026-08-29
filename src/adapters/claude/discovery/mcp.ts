import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Scope, SourceInfo } from "../../../core/model/index.js";
import type { ProjectScopeLevel } from "./project-walk.js";
import type { DiscoveredMcpServer } from "./types.js";

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

export function computeMcpServerId(configPath: string, name: string): string {
  return createHash("sha256").update(`${configPath}:${name}`).digest("hex").slice(0, 16);
}

function sortedKeys(value: unknown): string[] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return Object.keys(value).sort();
}

/**
 * Key-names-only config hash used for probe cache invalidation (§7.9).
 * Env and header *values* are never hashed or stored (invariant 10).
 */
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

function inferTransport(config: Record<string, unknown>): DiscoveredMcpServer["transport"] {
  if (typeof config.command === "string") {
    return "stdio";
  }
  if (typeof config.url === "string") {
    const url = config.url.toLowerCase();
    if (url.includes("sse")) {
      return "sse";
    }
    if (url.startsWith("ws")) {
      return "ws";
    }
    return "http";
  }
  return "unknown";
}

function source(scope: Scope, configPath: string): SourceInfo {
  return { platform: "claude", scope, path: configPath };
}

export async function discoverMcpServers(
  projectScopes: ProjectScopeLevel[],
  projectPath: string,
  repoRoot: string,
): Promise<DiscoveredMcpServer[]> {
  const servers: DiscoveredMcpServer[] = [];
  const seen = new Set<string>();
  const resolvedProject = path.resolve(projectPath);

  const addFromConfig = async (configPath: string, scope: Scope) => {
    const key = configPath;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);

    const json = await readJsonFile(configPath);
    if (!json) {
      return;
    }

    const mcpServers =
      json.mcpServers && typeof json.mcpServers === "object" && !Array.isArray(json.mcpServers)
        ? (json.mcpServers as Record<string, Record<string, unknown>>)
        : json;

    for (const [name, config] of Object.entries(mcpServers)) {
      if (!config || typeof config !== "object" || Array.isArray(config)) {
        continue;
      }
      const serverConfig = config as Record<string, unknown>;
      servers.push({
        id: computeMcpServerId(configPath, name),
        name,
        source: source(scope, configPath),
        configPath,
        transport: inferTransport(serverConfig),
        definitionKind: "config-file",
        status: "configured",
        configHash: computeMcpConfigHash(serverConfig),
      });
    }
  };

  for (const scope of projectScopes) {
    const scopeType: Scope =
      path.resolve(scope.path) === resolvedProject ? "project" : "nested-project";
    await addFromConfig(path.join(scope.path, ".mcp.json"), scopeType);
  }

  await addFromConfig(path.join(repoRoot, ".mcp.json"), "project");

  return servers;
}

export type McpServerRefResolution =
  | { kind: "found"; server: DiscoveredMcpServer }
  | { kind: "not-found" }
  | { kind: "ambiguous"; candidates: DiscoveredMcpServer[] };

/**
 * Resolves a user-supplied reference (configured name or opaque id) to a
 * discovered server. An ambiguous name is reported, never silently narrowed.
 */
export function resolveMcpServerRef(
  servers: DiscoveredMcpServer[],
  ref: string,
): McpServerRefResolution {
  const byId = servers.find((server) => server.id === ref);
  if (byId) {
    return { kind: "found", server: byId };
  }

  const byName = servers.filter((server) => server.name === ref);
  if (byName.length === 1) {
    return { kind: "found", server: byName[0]! };
  }
  if (byName.length > 1) {
    return { kind: "ambiguous", candidates: byName };
  }
  return { kind: "not-found" };
}
