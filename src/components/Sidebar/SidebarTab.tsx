import type { MutkaSidebarPanel } from "../../core/module-registry/module-registry.types";
import { ICON_REGISTRY } from "../ContextMenu/icon-registry";

interface SidebarTabProps {
  panel: MutkaSidebarPanel;
  isActive: boolean;
  onClick: (panel: MutkaSidebarPanel) => void;
}

/** A single icon button in the sidebar tab strip. */
export function SidebarTab({ panel, isActive, onClick }: SidebarTabProps) {
  const Icon = panel.icon ? ICON_REGISTRY[panel.icon] : undefined;
  return (
    <button
      className={`sidebar-tab${isActive ? " sidebar-tab--active" : ""}`}
      onClick={() => onClick(panel)}
      title={panel.title}
      aria-label={panel.title}
    >
      {Icon ? <Icon size={16} strokeWidth={1.8} /> : panel.icon ? <span>{panel.icon}</span> : null}
    </button>
  );
}
