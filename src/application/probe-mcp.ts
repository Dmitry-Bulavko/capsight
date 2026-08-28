import type { McpProbeResponse } from "../adapters/claude/probing/mcp-probe.js";
import { probeMcpServer } from "../adapters/claude/probing/mcp-probe.js";
import { resolveMcpServerRef } from "../adapters/claude/discovery/mcp.js";
import type { DiscoveredMcpServer } from "../adapters/claude/discovery/types.js";
import { getLastScan, getOrScan } from "./scan-store.js";

export class McpServerNotFoundError extends Error {
  constructor(serverId: string) {
    super(`MCP server not found: ${serverId}`);
    this.name = "McpServerNotFoundError";
  }
}

export interface McpServerCandidate {
  id: string;
  name: string;
  configPath: string;
}

export class McpServerAmbiguousError extends Error {
  readonly candidates: McpServerCandidate[];

  constructor(serverRef: string, candidates: McpServerCandidate[]) {
    super(
      `MCP server name is ambiguous: ${serverRef}. Candidates: ${candidates
        .map((candidate) => `${candidate.id} (${candidate.configPath})`)
        .join(", ")}`,
    );
    this.name = "McpServerAmbiguousError";
    this.candidates = candidates;
  }
}

export interface ProbeMcpOptions {
  /** Configured server name or the opaque discovered id. */
  serverId: string;
  confirmed: boolean;
  projectPath?: string;
}

function isDiscoveredMcpServer(value: unknown): value is DiscoveredMcpServer {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value &&
    "configPath" in value
  );
}

export async function probeMcp(options: ProbeMcpOptions): Promise<McpProbeResponse> {
  const scanResult = options.projectPath
    ? await getOrScan(options.projectPath)
    : getLastScan() ?? (await getOrScan());

  const servers = scanResult.snapshot.mcpServers.filter(isDiscoveredMcpServer);
  const resolution = resolveMcpServerRef(servers, options.serverId);

  if (resolution.kind === "ambiguous") {
    throw new McpServerAmbiguousError(
      options.serverId,
      resolution.candidates.map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        configPath: candidate.configPath,
      })),
    );
  }
  if (resolution.kind === "not-found") {
    throw new McpServerNotFoundError(options.serverId);
  }

  const discoveredServer = resolution.server;

  return probeMcpServer({
    serverId: discoveredServer.id,
    confirmed: options.confirmed,
    projectPath: scanResult.snapshot.projectPath,
    claudeVersion: scanResult.snapshot.version,
    discoveredServer,
  });
}
