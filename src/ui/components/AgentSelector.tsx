import { useId } from "react";
import type { Agent } from "../../core/model/index.js";
import { CapsightSelect } from "./CapsightSelect.js";

export const STATUS_LABELS: Record<Agent["status"], string> = {
  active: "Active",
  invalid: "Invalid",
  ambiguous: "Ambiguous",
  shadowed: "Shadowed",
  unknown: "Unknown",
};

/** Plain-text option label for screen readers. */
export function formatAgentOptionLabel(agent: Agent, compact: boolean): string {
  if (compact) {
    return `${agent.name} · ${STATUS_LABELS[agent.status]}`;
  }
  return `${agent.name} — ${STATUS_LABELS[agent.status]}`;
}

interface AgentSelectorProps {
  agents: Agent[];
  selectedAgentId: string | null;
  onAgentChange: (agentId: string) => void;
  compact?: boolean;
}

export function AgentSelector({
  agents,
  selectedAgentId,
  onAgentChange,
  compact = false,
}: AgentSelectorProps) {
  const selectId = useId();
  const sortedAgents = [...agents].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className={`agent-selector${compact ? " agent-selector-compact" : ""}`}>
      <label htmlFor={selectId}>Agent</label>
      <div className="agent-selector-row">
        <CapsightSelect
          id={selectId}
          className="capsight-select--agent"
          value={selectedAgentId ?? ""}
          options={sortedAgents.map((agent) => ({
            value: agent.id,
            label: agent.name,
            badge: {
              text: STATUS_LABELS[agent.status],
              tone: agent.status,
            },
            ariaLabel: formatAgentOptionLabel(agent, compact),
          }))}
          onChange={onAgentChange}
          disabled={sortedAgents.length === 0}
          ariaLabel="Agent"
          emptyLabel="No agents"
        />
      </div>
    </div>
  );
}
