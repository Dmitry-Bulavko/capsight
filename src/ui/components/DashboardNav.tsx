export type DashboardTab =
  | "overview"
  | "context"
  | "agents"
  | "editor"
  | "capabilities"
  | "graph"
  | "workflow-lab";

interface NavItem {
  id: DashboardTab;
  label: string;
  description: string;
}

export const DASHBOARD_NAV: readonly NavItem[] = [
  { id: "overview", label: "Overview", description: "Project scan & resources" },
  { id: "context", label: "Context", description: "Agent & execution preset" },
  { id: "agents", label: "Agents", description: "Discovered definitions" },
  { id: "editor", label: "Editor", description: "In-memory tool toggles" },
  { id: "capabilities", label: "Capabilities", description: "Effective resolution" },
  { id: "graph", label: "Graph", description: "Context-aware inspection" },
  { id: "workflow-lab", label: "Workflow Lab", description: "Block format preview (temp)" },
] as const;

interface DashboardNavProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  editorPendingCount?: number;
  disabled?: boolean;
}

export function DashboardNav({
  activeTab,
  onTabChange,
  editorPendingCount = 0,
  disabled = false,
}: DashboardNavProps) {
  return (
    <nav className="dashboard-nav" aria-label="Dashboard sections">
      <ul className="dashboard-nav-list">
        {DASHBOARD_NAV.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`dashboard-nav-item${activeTab === item.id ? " dashboard-nav-item-active" : ""}`}
              aria-current={activeTab === item.id ? "page" : undefined}
              disabled={disabled}
              onClick={() => onTabChange(item.id)}
            >
              <span className="dashboard-nav-label">
                {item.label}
                {item.id === "editor" && editorPendingCount > 0 && (
                  <span className="dashboard-nav-badge">{editorPendingCount}</span>
                )}
              </span>
              <span className="dashboard-nav-description">{item.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
