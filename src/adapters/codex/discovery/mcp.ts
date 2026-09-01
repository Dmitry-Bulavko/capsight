import fs from "node:fs/promises";
import path from "node:path";
import type { Scope, SourceInfo, TrustState } from "../../../core/model/index.js";
import { pathExists } from "../../shared/fs.js";
import { computeMcpConfigHash, computeMcpServerId } from "../../shared/mcp-hash.js";
import { inferMcpTransport } from "../../shared/infer-mcp-transport.js";
import { CODEX_PLATFORM } from "../model/index.js";
import { parseToml, getTomlTable } from "../parsing/toml.js";
import { extractEnvKeys } from "./redact.js";
import {
  readConfigFile,
  systemConfigPath,
  userConfigPath,
} from "./paths.js";
import type { WalkProjectScopesResult } from "./project-walk.js";
import { scopesRootToCwd } from "./project-walk.js";
import { shouldSkipProjectCodexLayers } from "./trust.js";
import type { DiscoveredMcpServer } from "./types.js";

export { computeMcpConfigHash, computeMcpServerId } from "../../shared/mcp-hash.js";

function source(scope: Scope, configPath: string): SourceInfo {
  return { platform: CODEX_PLATFORM, scope, path: configPath };
}

function extractMcpServersFromParsed(
  parsed: Record<string, unknown>,
): Record<string, Record<string, unknown>> {
  const table = getTomlTable(parsed, "mcp_servers");
  if (!table) {
    return {};
  }
  const result: Record<string, Record<string, unknown>> = {};
  for (const [name, value] of Object.entries(table)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[name] = value as Record<string, unknown>;
    }
  }
  return result;
}

async function addFromConfigPath(
  configPath: string,
  scope: Scope,
  servers: DiscoveredMcpServer[],
  seenNames: Map<string, string>,
): Promise<void> {
  const raw = await readConfigFile(configPath);
  if (!raw) {
    return;
  }

  const parsed = parseToml(raw);
  const mcpServers = extractMcpServersFromParsed(parsed as Record<string, unknown>);

  for (const [name, config] of Object.entries(mcpServers)) {
    const envKeys = extractEnvKeys(config);
    const existingPath = seenNames.get(name);
    if (existingPath) {
      const existingIndex = servers.findIndex(
        (server) => server.name === name && server.configPath === existingPath,
      );
      if (existingIndex >= 0) {
        servers.splice(existingIndex, 1);
      }
    }
    seenNames.set(name, configPath);
    servers.push({
      id: computeMcpServerId(configPath, name),
      name,
      source: source(scope, configPath),
      configPath,
      transport: inferMcpTransport(config),
      definitionKind: "config-file",
      status: "configured",
      configHash: computeMcpConfigHash(config),
      ...(envKeys.length > 0 ? { envKeys } : {}),
    });
  }
}

/** @see docs/CODEX-FACTS.md XM1–XM3 */
export async function discoverMcpServers(
  walk: WalkProjectScopesResult,
  trust: TrustState,
): Promise<DiscoveredMcpServer[]> {
  const servers: DiscoveredMcpServer[] = [];
  const seenNames = new Map<string, string>();
  const skipProjectCodex = shouldSkipProjectCodexLayers(trust);

  const systemPath = systemConfigPath();
  if (systemPath && (await pathExists(systemPath))) {
    await addFromConfigPath(systemPath, "managed", servers, seenNames);
  }

  const userPath = userConfigPath();
  if (await pathExists(userPath)) {
    await addFromConfigPath(userPath, "user", servers, seenNames);
  }

  if (!skipProjectCodex) {
    for (const scope of scopesRootToCwd(walk)) {
      if (!scope.codexConfigPath) {
        continue;
      }
      const scopeType: Scope =
        path.resolve(scope.path) === path.resolve(walk.projectPath)
          ? "project"
          : "nested-project";
      await addFromConfigPath(scope.codexConfigPath, scopeType, servers, seenNames);
    }
  }

  return servers;
}
