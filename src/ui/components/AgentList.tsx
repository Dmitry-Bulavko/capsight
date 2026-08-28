import type { Agent } from "../../core/model/index.js";

interface AgentListProps {
  agents: Agent[];
}

const STATUS_LABELS: Record<Agent["status"], string> = {
  active: "Active",
  invalid: "Invalid",
  ambiguous: "Ambiguous",
  shadowed: "Shadowed",
  unknown: "Unknown",
};

function agentPath(agent: Agent): string {
  return agent.source.path ?? "—";
}

export function AgentList({ agents }: AgentListProps) {
  if (agents.length === 0) {
    return (
      <section className="panel agent-list">
        <h2>Agents</h2>
        <p className="empty-state">No agents discovered.</p>
      </section>
    );
  }

  const sorted = [...agents].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="panel agent-list">
      <h2>Agents ({agents.length})</h2>
      <ul className="agent-items">
        {sorted.map((agent) => (
          <li key={agent.id} className={`agent-item status-${agent.status}`}>
            <div className="agent-header">
              <span className="agent-name">{agent.name}</span>
              <span className={`status-badge status-${agent.status}`}>
                {STATUS_LABELS[agent.status]}
              </span>
            </div>
            <dl className="agent-meta">
              <div>
                <dt>Scope</dt>
                <dd>{agent.source.scope}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd className="mono truncate" title={agentPath(agent)}>
                  {agentPath(agent)}
                </dd>
              </div>
            </dl>
            {agent.status === "invalid" && agent.invalidReason && (
              <p className="invalid-reason">
                Invalid: <code>{agent.invalidReason}</code>
              </p>
            )}
            {(agent.status === "ambiguous" || agent.status === "shadowed") &&
              agent.collision && (
                <p className="collision-note">
                  {agent.status === "ambiguous"
                    ? "Name collision — no effective winner selected."
                    : "Shadowed by another definition."}
                  {agent.collision.rule && (
                    <>
                      {" "}
                      <span className="collision-rule">({agent.collision.rule})</span>
                    </>
                  )}
                </p>
              )}
          </li>
        ))}
      </ul>
    </section>
  );
}
