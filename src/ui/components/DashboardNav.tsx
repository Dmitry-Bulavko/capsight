export type DashboardTab = "ecosystem" | "agents" | "simulation";

interface NavItem {
  id: DashboardTab;
  label: string;
  description: string;
}

export const DASHBOARD_NAV: readonly NavItem[] = [
  { id: "ecosystem", label: "Ecosystem", description: "Declared inventory — all platforms" },
  { id: "agents", label: "Agents", description: "Effective resolution workspace" },
  { id: "simulation", label: "Simulation", description: "Managed policy overlay preview" },
] as const;

interface DashboardNavProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  disabled?: boolean;
}

export function DashboardNav({
  activeTab,
  onTabChange,
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
              <span className="dashboard-nav-label">{item.label}</span>
              <span className="dashboard-nav-description">{item.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
