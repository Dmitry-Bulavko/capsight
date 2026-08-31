/**
 * S9P-01 — Normalized Agent SDK probe result schema and validators.
 * Dev-only; not wired to scan.
 */

/** Aggregated probe output for findings doc cross-check. */
export interface AgentSdkProbeResult {
  fixtureCwd: string;
  attemptedApis: string[];
  mcpServerStatus: {
    servers: Array<{
      name: string;
      status: string;
      toolNames: string[];
    }>;
  } | null;
  contextUsage: {
    mcpToolNames: string[];
    deferredBuiltinToolNames: string[];
    systemToolNames: string[];
  } | null;
  initialization: {
    agentNames: string[];
    /** `initializationResult()` control API — no tools field in documented response. */
    hasToolsField: false;
  } | null;
  /** Wire tool names from SDK stream `system`/`init` message when emitted. */
  initStreamTools: {
    toolNames: string[];
  } | null;
  notes: string[];
}

export type AgentSdkProbeProvenance = "live" | "doc-derived-synthetic";

/** Committed fixture payload envelope for CI schema tests. */
export interface AgentSdkProbeRecording {
  meta: {
    fixtureId: string;
    fixturePath: string;
    recordedAt: string;
    provenance: AgentSdkProbeProvenance;
    sdkVersion?: string;
    claudeCodeVersion?: string;
    notes?: string;
  };
  result: AgentSdkProbeResult;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isAgentSdkProbeResult(value: unknown): value is AgentSdkProbeResult {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;

  if (typeof r.fixtureCwd !== "string") return false;
  if (!isStringArray(r.attemptedApis)) return false;
  if (!isStringArray(r.notes)) return false;

  if (r.mcpServerStatus !== null) {
    if (typeof r.mcpServerStatus !== "object" || !r.mcpServerStatus) return false;
    const mcp = r.mcpServerStatus as Record<string, unknown>;
    if (!Array.isArray(mcp.servers)) return false;
    for (const server of mcp.servers) {
      if (!server || typeof server !== "object") return false;
      const s = server as Record<string, unknown>;
      if (typeof s.name !== "string" || typeof s.status !== "string") return false;
      if (!isStringArray(s.toolNames)) return false;
    }
  }

  if (r.contextUsage !== null) {
    if (typeof r.contextUsage !== "object" || !r.contextUsage) return false;
    const usage = r.contextUsage as Record<string, unknown>;
    if (
      !isStringArray(usage.mcpToolNames) ||
      !isStringArray(usage.deferredBuiltinToolNames) ||
      !isStringArray(usage.systemToolNames)
    ) {
      return false;
    }
  }

  if (r.initialization !== null) {
    if (typeof r.initialization !== "object" || !r.initialization) return false;
    const init = r.initialization as Record<string, unknown>;
    if (!isStringArray(init.agentNames)) return false;
    if (init.hasToolsField !== false) return false;
  }

  if (r.initStreamTools !== null) {
    if (typeof r.initStreamTools !== "object" || !r.initStreamTools) return false;
    const stream = r.initStreamTools as Record<string, unknown>;
    if (!isStringArray(stream.toolNames)) return false;
  }

  return true;
}

/** Validate a committed probe recording JSON envelope. */
export function validateAgentSdkProbeRecording(
  value: unknown,
): value is AgentSdkProbeRecording {
  if (!value || typeof value !== "object") return false;
  const rec = value as Record<string, unknown>;
  if (!rec.meta || typeof rec.meta !== "object" || !rec.meta) return false;

  const meta = rec.meta as Record<string, unknown>;
  if (typeof meta.fixtureId !== "string") return false;
  if (typeof meta.fixturePath !== "string") return false;
  if (typeof meta.recordedAt !== "string") return false;
  if (meta.provenance !== "live" && meta.provenance !== "doc-derived-synthetic") {
    return false;
  }
  if (meta.sdkVersion !== undefined && typeof meta.sdkVersion !== "string") {
    return false;
  }
  if (meta.claudeCodeVersion !== undefined && typeof meta.claudeCodeVersion !== "string") {
    return false;
  }
  if (meta.notes !== undefined && typeof meta.notes !== "string") return false;

  return isAgentSdkProbeResult(rec.result);
}

/**
 * Extract init `tools[]` wire names from an SDK stream message when present.
 * Matches `SDKSystemMessage` with `type: "system"`, `subtype: "init"`.
 */
export function extractInitToolsFromStreamMessage(message: unknown): string[] | null {
  if (!message || typeof message !== "object") return null;
  const msg = message as Record<string, unknown>;
  if (msg.type !== "system" || msg.subtype !== "init") return null;
  if (!Array.isArray(msg.tools)) return null;

  const toolNames = msg.tools.filter((tool): tool is string => typeof tool === "string");
  return toolNames.length > 0 ? toolNames : null;
}
