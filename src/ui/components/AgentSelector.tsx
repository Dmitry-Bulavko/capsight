import { useId } from "react";
import type { Agent } from "../../core/model/index.js";

const STATUS_LABELS: Record<Agent["status"], string> = {
  active: "Active",
  invalid: "Invalid",
  ambiguous: "Ambiguous",
  shadowed: "Shadowed",
  unknown: "Unknown",
};

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
      <select
        id={selectId}
        className="agent-select"
        value={selectedAgentId ?? ""}
        onChange={(event) => onAgentChange(event.target.value)}
        disabled={sortedAgents.length === 0}
      >
        <button type="button">
          <selectedcontent />
        </button>
        {sortedAgents.length === 0 ? (
          <option value="">No agents</option>
        ) : (
          sortedAgents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              <span className="agent-option-name">{agent.name}</span>
              <span className={`status-badge status-${agent.status}`}>
                {STATUS_LABELS[agent.status]}
              </span>
            </option>
          ))
        )}
      </select>
    </div>
  );
}
