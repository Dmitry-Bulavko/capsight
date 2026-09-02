export type AgentCenterView = "capabilities" | "graph";

interface CenterNavItem {
  id: AgentCenterView;
  label: string;
}

export const AGENT_CENTER_NAV: readonly CenterNavItem[] = [
  { id: "capabilities", label: "Capabilities" },
  { id: "graph", label: "Graph" },
] as const;

interface AgentCenterNavProps {
  activeView: AgentCenterView;
  onViewChange: (view: AgentCenterView) => void;
  editorPendingCount?: number;
}

export function AgentCenterNav({
  activeView,
  onViewChange,
  editorPendingCount = 0,
}: AgentCenterNavProps) {
  return (
    <nav className="agent-inspector-nav agent-center-nav" aria-label="Workspace view">
      <ul className="agent-inspector-nav-list">
        {AGENT_CENTER_NAV.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`agent-inspector-nav-item${activeView === item.id ? " agent-inspector-nav-item-active" : ""}`}
              aria-current={activeView === item.id ? "page" : undefined}
              onClick={() => onViewChange(item.id)}
            >
              {item.label}
              {item.id === "capabilities" && editorPendingCount > 0 && (
                <span className="agent-inspector-nav-badge">{editorPendingCount}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
