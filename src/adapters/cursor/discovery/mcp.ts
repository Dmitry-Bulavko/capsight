import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { Scope, SourceInfo } from "../../../core/model/index.js";
import { readJsonObject } from "../../shared/fs.js";
import { computeMcpConfigHash, computeMcpServerId } from "../../shared/mcp-hash.js";
import { inferMcpTransport } from "../../shared/infer-mcp-transport.js";
import { CURSOR_PLATFORM } from "../model/index.js";
import { extractEnvKeys } from "./redact.js";
import type { ProjectScopeLevel } from "./project-walk.js";
import type { DiscoveredMcpServer } from "./types.js";

export { computeMcpConfigHash, computeMcpServerId } from "../../shared/mcp-hash.js";

function source(scope: Scope, configPath: string): SourceInfo {
  return { platform: CURSOR_PLATFORM, scope, path: configPath };
}

/** @see docs/CURSOR-FACTS.md CM1–CM3 */
export async function discoverMcpServers(
  projectScopes: ProjectScopeLevel[],
  projectPath: string,
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
        : undefined;

    if (!mcpServers) {
      return;
    }

    for (const [name, config] of Object.entries(mcpServers)) {
      if (!config || typeof config !== "object" || Array.isArray(config)) {
        continue;
      }
      const serverConfig = config as Record<string, unknown>;
      const envKeys = extractEnvKeys(serverConfig);
      servers.push({
        id: computeMcpServerId(configPath, name),
        name,
        source: source(scope, configPath),
        configPath,
        transport: inferMcpTransport(serverConfig),
        definitionKind: "config-file",
        status: "configured",
        configHash: computeMcpConfigHash(serverConfig),
        ...(envKeys.length > 0 ? { envKeys } : {}),
      });
    }
  };

  for (const scope of projectScopes) {
    const scopeType: Scope =
      path.resolve(scope.path) === resolvedProject ? "project" : "nested-project";
    if (scope.mcpPath) {
      await addFromConfig(scope.mcpPath, scopeType);
    }
  }

  const userMcp = path.join(os.homedir(), ".cursor", "mcp.json");
  await addFromConfig(userMcp, "user");

  return servers;
}
