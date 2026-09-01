import fs from "node:fs/promises";
import path from "node:path";
import { readJsonObject } from "../../shared/fs.js";
import { inferMcpTransport } from "../../shared/infer-mcp-transport.js";
import { computeMcpConfigHash, computeMcpServerId } from "../../shared/mcp-hash.js";
import type { Scope, SourceInfo } from "../../../core/model/index.js";
import type { ProjectScopeLevel } from "./project-walk.js";
import type { DiscoveredMcpServer } from "./types.js";

export { computeMcpConfigHash, computeMcpServerId } from "../../shared/mcp-hash.js";

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

    const json = await readJsonObject(configPath);
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
        transport: inferMcpTransport(serverConfig),
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
