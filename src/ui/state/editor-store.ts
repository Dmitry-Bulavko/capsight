import type { Agent, EffectiveConfiguration } from "../../core/model/index.js";

/** In-memory pending edits only — never persisted (SPEC M3 #9). */
export interface EditorPendingState {
  /** agentId → toolName → desired enabled state */
  byAgent: Record<string, Record<string, boolean>>;
}

export function createEmptyEditorState(): EditorPendingState {
  return { byAgent: {} };
}

/** Patterns are shown in the list but not individually toggled in M3-01. */
export function isEditableToolName(name: string): boolean {
  return !name.includes("*") && !name.includes("(");
}

export function collectEditableTools(
  agent: Agent,
  effective: EffectiveConfiguration | null,
): string[] {
  const names = new Set<string>();

  for (const tool of agent.configuration.tools ?? []) {
    if (isEditableToolName(tool)) {
      names.add(tool);
    }
  }
  for (const tool of agent.configuration.disallowedTools ?? []) {
    if (isEditableToolName(tool)) {
      names.add(tool);
    }
  }
  if (effective) {
    for (const capability of effective.capabilities) {
      if (capability.kind === "tool" || capability.kind === "mcp_tool") {
        names.add(capability.capabilityId);
      }
    }
  }

  return [...names].sort((left, right) => left.localeCompare(right));
}

/** Baseline enablement from discovered agent frontmatter (exact names only). */
export function baselineToolEnabled(agent: Agent, toolName: string): boolean {
  const disallowed = agent.configuration.disallowedTools ?? [];
  if (disallowed.includes(toolName)) {
    return false;
  }

  const tools = agent.configuration.tools;
  if (tools !== undefined) {
    return tools.includes(toolName);
  }

  return true;
}

export function desiredToolEnabled(
  agent: Agent,
  pending: EditorPendingState,
  toolName: string,
): boolean {
  const override = pending.byAgent[agent.id]?.[toolName];
  if (override !== undefined) {
    return override;
  }
  return baselineToolEnabled(agent, toolName);
}

export function toggleTool(
  pending: EditorPendingState,
  agent: Agent,
  toolName: string,
): EditorPendingState {
  const nextEnabled = !desiredToolEnabled(agent, pending, toolName);
  const baseline = baselineToolEnabled(agent, toolName);
  const agentEdits = { ...(pending.byAgent[agent.id] ?? {}) };

  if (nextEnabled === baseline) {
    delete agentEdits[toolName];
  } else {
    agentEdits[toolName] = nextEnabled;
  }

  const byAgent = { ...pending.byAgent };
  if (Object.keys(agentEdits).length === 0) {
    delete byAgent[agent.id];
  } else {
    byAgent[agent.id] = agentEdits;
  }

  return { byAgent };
}

export function countPendingChanges(agent: Agent, pending: EditorPendingState): number {
  return Object.keys(pending.byAgent[agent.id] ?? {}).length;
}

export function clearAgentPending(pending: EditorPendingState, agentId: string): EditorPendingState {
  if (!pending.byAgent[agentId]) {
    return pending;
  }
  const byAgent = { ...pending.byAgent };
  delete byAgent[agentId];
  return { byAgent };
}

export function hasPendingChanges(pending: EditorPendingState): boolean {
  return Object.keys(pending.byAgent).length > 0;
}
