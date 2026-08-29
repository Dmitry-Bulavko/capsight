import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import os from "node:os";
import type { Scope, SourceInfo } from "../../../core/model/index.js";
import { inferMcpTransport } from "../../shared/infer-mcp-transport.js";
import { CURSOR_PLATFORM } from "../model/index.js";
import { extractEnvKeys } from "./redact.js";
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

/** Key-names-only config hash — env values never stored (CM3). */
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

    const json = await readJsonFile(configPath);
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
