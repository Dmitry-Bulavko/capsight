import { useId } from "react";
import type { Agent } from "../../core/model/index.js";

export const STATUS_LABELS: Record<Agent["status"], string> = {
  active: "Active",
  invalid: "Invalid",
  ambiguous: "Ambiguous",
  shadowed: "Shadowed",
  unknown: "Unknown",
};

/** Plain-text option label — valid inside `<option>` (no nested elements). */
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
  const selectedAgent = sortedAgents.find((agent) => agent.id === selectedAgentId);

  return (
    <div className={`agent-selector${compact ? " agent-selector-compact" : ""}`}>
      <label htmlFor={selectId}>Agent</label>
      <div className="agent-selector-row">
        <select
          id={selectId}
          className="agent-select"
          value={selectedAgentId ?? ""}
          onChange={(event) => onAgentChange(event.target.value)}
          disabled={sortedAgents.length === 0}
        >
          {sortedAgents.length === 0 ? (
            <option value="">No agents</option>
          ) : (
            sortedAgents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {formatAgentOptionLabel(agent, compact)}
              </option>
            ))
          )}
        </select>
        {selectedAgent && (
          <span
            className={`status-badge status-${selectedAgent.status} agent-selector-status`}
            aria-label={`Status: ${STATUS_LABELS[selectedAgent.status]}`}
          >
            {STATUS_LABELS[selectedAgent.status]}
          </span>
        )}
      </div>
    </div>
  );
}
