import type { InspectionGraph } from "../core/graph/build-graph.js";
import type {
  Agent,
  ContextPreset,
  EffectiveConfiguration,
  ExecutionContext,
  PlatformVersion,
  ResolvedCapability,
  Warning,
} from "../core/model/index.js";
import type { PlatformId } from "../adapters/platform.js";
import type { ScanResult } from "../application/scan.js";
import type { ResourceContentResult } from "../application/resource-content.js";
import type {
  PlanPendingState,
  PlanResult,
} from "../application/plan.js";
import type { ManagedSimulationResult } from "../application/simulate.js";
import type { ScanStatusSummary } from "../application/scan-store.js";
import type { ObservedSessionPayload } from "../core/observed/session.js";
import type {
  EcosystemApiPayload,
  EcosystemResourceDetail,
} from "../server/routes/ecosystem.js";

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

export type BrowseProjectFolderCancelReason = "dismissed" | "unavailable" | "busy" | "timeout";

export type BrowseProjectFolderResult =
  | { cancelled: false; path: string }
  | { cancelled: true; reason?: BrowseProjectFolderCancelReason };

export async function browseProjectFolder(): Promise<BrowseProjectFolderResult> {
  return request<BrowseProjectFolderResult>("/api/project/browse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
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

/** Mirrors `AgentWarning` from `GET /api/warnings`. */
export interface AgentWarning extends Warning {
  agentId: string;
}

export interface WarningsApiPayload {
  warnings: AgentWarning[];
  contextDefault?: { preset: ContextPreset; reason: string };
}

export async function fetchWarnings(context: ContextPreset): Promise<WarningsApiPayload> {
  const params = new URLSearchParams({ context });
  return request<WarningsApiPayload>(`/api/warnings?${params.toString()}`);
}

export interface CapabilityExplain {
  agentId: string;
  context: ExecutionContext;
  capability: ResolvedCapability;
}

export type { ObservedSessionPayload };

export async function fetchObservedSession(): Promise<ObservedSessionPayload | null> {
  try {
    return await request<ObservedSessionPayload>("/api/observed");
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
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

export async function fetchGraph(
  context: ContextPreset,
  agentId?: string,
): Promise<InspectionGraph> {
  const params = new URLSearchParams({ context });
  if (agentId) {
    params.set("agent", agentId);
  }
  return request<InspectionGraph>(`/api/graph?${params.toString()}`);
}

export async function scanProject(
  projectPath?: string,
  platform?: PlatformId,
): Promise<ScanResult> {
  const trimmed = projectPath?.trim();
  return request<ScanResult>("/api/project/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(trimmed ? { projectPath: trimmed } : {}),
      ...(platform ? { platform } : {}),
    }),
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

export async function fetchEcosystem(): Promise<EcosystemApiPayload> {
  return request<EcosystemApiPayload>("/api/ecosystem");
}

export async function fetchEcosystemResource(id: string): Promise<EcosystemResourceDetail> {
  return request<EcosystemResourceDetail>(`/api/ecosystem/resource/${encodeURIComponent(id)}`);
}

export async function fetchEcosystemResourceContent(id: string): Promise<ResourceContentResult> {
  return request<ResourceContentResult>(
    `/api/ecosystem/resource/${encodeURIComponent(id)}/content`,
  );
}

export type {
  PlanFieldChange,
  PlanFileChange,
  PlanPendingState,
  PlanResult,
  PlanWarning,
} from "../application/plan.js";
export type {
  EcosystemApiPayload,
  EcosystemResourceDetail,
} from "../server/routes/ecosystem.js";
export { isMarkdownContentKind } from "../core/model/ecosystem.js";
export type { ResourceContentResult } from "../application/resource-content.js";

export async function fetchPlan(
  pending: PlanPendingState,
  editSnapshotId: string,
): Promise<PlanResult> {
  return request<PlanResult>("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pending, editSnapshotId }),
  });
}

export type {
  ManagedSimulationDelta,
  ManagedSimulationResult,
} from "../application/simulate.js";

export async function fetchSimulateManaged(
  managedBundlePath: string,
): Promise<ManagedSimulationResult> {
  const trimmed = managedBundlePath.trim();
  return request<ManagedSimulationResult>("/api/simulate/managed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ managedBundlePath: trimmed }),
  });
}
