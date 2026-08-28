import type { McpProbeResponse } from "../adapters/claude/probing/mcp-probe.js";
import { probeMcpServer } from "../adapters/claude/probing/mcp-probe.js";
import type { DiscoveredMcpServer } from "../adapters/claude/discovery/types.js";
import { getLastScan, getOrScan } from "./scan-store.js";

export class McpServerNotFoundError extends Error {
  constructor(serverId: string) {
    super(`MCP server not found: ${serverId}`);
    this.name = "McpServerNotFoundError";
  }
}

export interface ProbeMcpOptions {
  serverId: string;
  confirmed: boolean;
  projectPath?: string;
}

function findDiscoveredServer(
  mcpServers: unknown[],
  serverId: string,
): DiscoveredMcpServer | undefined {
  return mcpServers.find(
    (server): server is DiscoveredMcpServer =>
      typeof server === "object" &&
      server !== null &&
      "id" in server &&
      (server as DiscoveredMcpServer).id === serverId,
  );
}

export async function probeMcp(options: ProbeMcpOptions): Promise<McpProbeResponse> {
  const scanResult = options.projectPath
    ? await getOrScan(options.projectPath)
    : getLastScan() ?? (await getOrScan());

  const discoveredServer = findDiscoveredServer(
    scanResult.snapshot.mcpServers,
    options.serverId,
  );
  if (!discoveredServer) {
    throw new McpServerNotFoundError(options.serverId);
  }

  return probeMcpServer({
    serverId: options.serverId,
    confirmed: options.confirmed,
    projectPath: scanResult.snapshot.projectPath,
    claudeVersion: scanResult.snapshot.version,
    discoveredServer,
  });
}
