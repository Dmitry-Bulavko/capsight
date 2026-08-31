import type { Agent, AgentConfiguration, UnknownFieldType } from "../../core/model/index.js";

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

/** Primary array fields — always shown so absent vs empty stays visible. */
const ARRAY_FIELDS = ["tools", "disallowedTools", "skills"] as const;

/** Scalar / structural fields shown only when declared. */
const OPTIONAL_SCALAR_FIELDS = ["model", "permissionMode"] as const;

type ArrayField = (typeof ARRAY_FIELDS)[number];
type OptionalScalarField = (typeof OPTIONAL_SCALAR_FIELDS)[number];

interface RedactedMcpServerLike {
  name?: string;
  transport?: string;
  commandName?: string;
  envKeys?: string[];
  headerKeys?: string[];
}

interface HooksSummaryLike {
  form: "object" | "array" | "scalar";
  events: string[];
  count: number;
}

function agentPath(agent: Agent): string {
  return agent.source.path ?? "—";
}

function configRecord(configuration: AgentConfiguration): Record<string, unknown> {
  return configuration as unknown as Record<string, unknown>;
}

export function formatDeclaredStringList(value: string[] | undefined): {
  kind: "absent" | "empty" | "values";
  text: string;
} {
  if (value === undefined) {
    return { kind: "absent", text: "not declared" };
  }
  if (value.length === 0) {
    return { kind: "empty", text: "empty" };
  }
  return { kind: "values", text: value.join(", ") };
}

export function formatUnknownFieldType(type: UnknownFieldType): string {
  return `unrecognized (${type})`;
}

export function formatMcpServerEntry(entry: string | RedactedMcpServerLike): string {
  if (typeof entry === "string") {
    return entry;
  }

  const parts: string[] = [];
  if (entry.name) {
    parts.push(entry.name);
  }
  if (entry.transport) {
    parts.push(`transport: ${entry.transport}`);
  }
  if (entry.commandName) {
    parts.push(`command: ${entry.commandName}`);
  }
  const envKeys = entry.envKeys ?? [];
  if (envKeys.length > 0) {
    parts.push(`env keys: ${envKeys.join(", ")}`);
  }
  const headerKeys = entry.headerKeys ?? [];
  if (headerKeys.length > 0) {
    parts.push(`header keys: ${headerKeys.join(", ")}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "inline MCP server";
}

export function formatHooksSummary(hooks: HooksSummaryLike): string {
  if (hooks.form === "scalar") {
    return "scalar value (redacted)";
  }
  if (hooks.events.length > 0) {
    return `${hooks.form} — events: ${hooks.events.join(", ")} (${hooks.count} hook group${hooks.count === 1 ? "" : "s"})`;
  }
  return `${hooks.form} — ${hooks.count} hook group${hooks.count === 1 ? "" : "s"}`;
}

export function hasDeclaredConfiguration(configuration: AgentConfiguration): boolean {
  const record = configRecord(configuration);
  for (const field of ARRAY_FIELDS) {
    if (record[field] !== undefined) {
      return true;
    }
  }
  for (const field of OPTIONAL_SCALAR_FIELDS) {
    if (record[field] !== undefined) {
      return true;
    }
  }
  if (record.mcpServers !== undefined || record.hooks !== undefined) {
    return true;
  }
  return Object.keys(configuration.unknownFields).length > 0;
}

function DeclaredListValue({
  value,
}: {
  value: ReturnType<typeof formatDeclaredStringList>;
}) {
  if (value.kind === "absent") {
    return <span className="agent-config-absent">{value.text}</span>;
  }
  if (value.kind === "empty") {
    return <span className="agent-config-empty">{value.text}</span>;
  }
  return <span className="mono">{value.text}</span>;
}

function AgentDeclaredConfiguration({ agent }: { agent: Agent }) {
  const record = configRecord(agent.configuration);
  const notInEffect = agent.status === "invalid";

  return (
    <div
      className={`agent-declared-config${notInEffect ? " agent-declared-config--not-in-effect" : ""}`}
    >
      <h3 className="agent-declared-config-heading">Declared configuration</h3>
      {notInEffect && (
        <p className="agent-config-not-in-effect-note">
          Parsed frontmatter is shown for evidence; it is not in effect while the agent is invalid.
        </p>
      )}
      <dl className="agent-declared-config-fields">
        {ARRAY_FIELDS.map((field) => {
          const raw = record[field];
          const list = Array.isArray(raw) ? raw.map(String) : undefined;
          const formatted = formatDeclaredStringList(list);
          return (
            <div key={field}>
              <dt>{field}</dt>
              <dd>
                <DeclaredListValue value={formatted} />
              </dd>
            </div>
          );
        })}
        {OPTIONAL_SCALAR_FIELDS.map((field) => {
          const value = record[field];
          if (value === undefined) {
            return null;
          }
          return (
            <div key={field}>
              <dt>{field}</dt>
              <dd className="mono">{String(value)}</dd>
            </div>
          );
        })}
        {record.hooks !== undefined && (
          <div className="agent-declared-config-wide">
            <dt>hooks</dt>
            <dd>{formatHooksSummary(record.hooks as HooksSummaryLike)}</dd>
          </div>
        )}
        {Array.isArray(record.mcpServers) && (
          <div className="agent-declared-config-wide">
            <dt>mcpServers</dt>
            <dd>
              <ul className="agent-config-mcp-list">
                {(record.mcpServers as Array<string | RedactedMcpServerLike>).map((entry, index) => (
                  <li key={`${formatMcpServerEntry(entry)}:${index}`} className="mono">
                    {formatMcpServerEntry(entry)}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {Object.entries(agent.configuration.unknownFields)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, type]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>
                <span className="agent-config-unrecognized">{formatUnknownFieldType(type)}</span>
              </dd>
            </div>
          ))}
      </dl>
    </div>
  );
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
            <AgentDeclaredConfiguration agent={agent} />
          </li>
        ))}
      </ul>
    </section>
  );
}
