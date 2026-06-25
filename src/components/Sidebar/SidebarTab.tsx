import type { MutkaSidebarPanel } from "../../core/module-registry/module-registry.types";

interface SidebarTabProps {
  panel: MutkaSidebarPanel;
  isActive: boolean;
  onClick: (panel: MutkaSidebarPanel) => void;
}

/** A single icon button in the sidebar tab strip. */
export function SidebarTab({ panel, isActive, onClick }: SidebarTabProps) {
  return (
    <button
      className={`sidebar-tab${isActive ? " sidebar-tab--active" : ""}`}
      onClick={() => onClick(panel)}
      title={panel.title}
      aria-label={panel.title}
    >
      {panel.icon}
    </button>
  );
}
