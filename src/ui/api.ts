import type { InspectionGraph } from "../core/graph/build-graph.js";
import type {
  Agent,
  ContextPreset,
  EffectiveConfiguration,
  ExecutionContext,
  PlatformVersion,
  ResolvedCapability,
} from "../core/model/index.js";
import type { ScanResult } from "../application/scan.js";
import type { ScanStatusSummary } from "../application/scan-store.js";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

export async function fetchProject(): Promise<ScanStatusSummary> {
  return request<ScanStatusSummary>("/api/project");
}

export interface ProjectConfig {
  defaultProjectPath: string;
}

export async function fetchProjectConfig(): Promise<ProjectConfig> {
  return request<ProjectConfig>("/api/project/config");
}

export type BrowseProjectFolderResult = { cancelled: true } | { cancelled: false; path: string };

export async function browseProjectFolder(): Promise<BrowseProjectFolderResult> {
  return request<BrowseProjectFolderResult>("/api/project/browse", {
    method: "POST",
  });
}

export async function fetchAgents(): Promise<Agent[]> {
  const body = await request<{ agents: Agent[] }>("/api/agents");
  return body.agents;
}

export async function fetchEffectiveConfig(
  agentId: string,
  context: ContextPreset,
): Promise<EffectiveConfiguration> {
  const params = new URLSearchParams({ context });
  return request<EffectiveConfiguration>(
    `/api/agents/${encodeURIComponent(agentId)}/effective?${params.toString()}`,
  );
}

export interface CapabilityExplain {
  agentId: string;
  context: ExecutionContext;
  capability: ResolvedCapability;
}

export async function fetchExplain(
  capabilityId: string,
  agentId: string,
  context: ContextPreset,
): Promise<CapabilityExplain> {
  const params = new URLSearchParams({ agent: agentId, context });
  return request<CapabilityExplain>(
    `/api/capabilities/${encodeURIComponent(capabilityId)}/explain?${params.toString()}`,
  );
}

export async function fetchGraph(context: ContextPreset): Promise<InspectionGraph> {
  const params = new URLSearchParams({ context });
  return request<InspectionGraph>(`/api/graph?${params.toString()}`);
}

export async function scanProject(projectPath?: string): Promise<ScanResult> {
  const trimmed = projectPath?.trim();
  return request<ScanResult>("/api/project/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trimmed ? { projectPath: trimmed } : {}),
  });
}

export function formatVersion(version: PlatformVersion | undefined): string {
  if (!version?.version) return "unknown";
  return version.version;
}

export function resourceCountsFromScan(scan: ScanResult): {
  skills: number;
  instructions: number;
  mcpServers: number;
} {
  const { snapshot } = scan;
  return {
    skills: snapshot.skills.length,
    instructions: snapshot.instructions.length,
    mcpServers: snapshot.mcpServers.length,
  };
}
