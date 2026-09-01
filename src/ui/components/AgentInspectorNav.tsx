export type AgentInspectorTab =
  | "overview"
  | "context"
  | "capabilities"
  | "warnings"
  | "graph"
  | "editor";

interface NavItem {
  id: AgentInspectorTab;
  label: string;
}

export const AGENT_INSPECTOR_NAV: readonly NavItem[] = [
  { id: "overview", label: "Overview" },
  { id: "context", label: "Context" },
  { id: "capabilities", label: "Capabilities" },
  { id: "warnings", label: "Warnings" },
  { id: "graph", label: "Graph" },
  { id: "editor", label: "Editor" },
] as const;

interface AgentInspectorNavProps {
  activeTab: AgentInspectorTab;
  onTabChange: (tab: AgentInspectorTab) => void;
  editorPendingCount?: number;
}

export function AgentInspectorNav({
  activeTab,
  onTabChange,
  editorPendingCount = 0,
}: AgentInspectorNavProps) {
  return (
    <nav className="agent-inspector-nav" aria-label="Agent inspector sections">
      <ul className="agent-inspector-nav-list">
        {AGENT_INSPECTOR_NAV.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`agent-inspector-nav-item${activeTab === item.id ? " agent-inspector-nav-item-active" : ""}`}
              aria-current={activeTab === item.id ? "page" : undefined}
              onClick={() => onTabChange(item.id)}
            >
              {item.label}
              {item.id === "editor" && editorPendingCount > 0 && (
                <span className="agent-inspector-nav-badge">{editorPendingCount}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
