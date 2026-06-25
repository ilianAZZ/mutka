import { useState, useCallback, useMemo } from "react";
import type { MutkaSidebarPanel, SidebarPanelProps } from "../../core/module-registry/module-registry.types";
import { SidebarTab } from "./SidebarTab";
import "./Sidebar.css";

interface SidebarProps {
  /** Which edge this sidebar occupies. Determines tab-strip placement. */
  side: "left" | "right";
  /** Panels assigned to this side, in registration order. */
  panels: MutkaSidebarPanel[];
  /** Shared props handed to every panel component. */
  panelProps: SidebarPanelProps;
}

const MIN_WIDTH = 180;
const MAX_WIDTH = 480;

function clampWidth(width: number | undefined): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width ?? 240));
}

/**
 * Renders a module-contributed sidebar for one edge of the window.
 * Multiple panels on the same side share a vertical icon strip; clicking the
 * active panel's icon collapses the sidebar to just the strip.
 * Renders nothing when no module contributes a panel for this side.
 */
export function Sidebar({ side, panels, panelProps }: SidebarProps) {
  const [activeId, setActiveId] = useState<string>(() => panels[0]?.id ?? "");
  const [collapsed, setCollapsed] = useState(false);

  const active = useMemo(
    () => panels.find((p) => p.id === activeId) ?? panels[0],
    [panels, activeId]
  );

  const handleTabClick = useCallback((panel: MutkaSidebarPanel) => {
    if (panel.id === activeId) {
      setCollapsed((c) => !c);
    } else {
      setActiveId(panel.id);
      setCollapsed(false);
    }
  }, [activeId]);

  if (panels.length === 0 || !active) return null;

  const Panel = active.component;
  const strip = (
    <div className="sidebar-strip">
      {panels.map((panel) => (
        <SidebarTab
          key={panel.id}
          panel={panel}
          isActive={panel.id === active.id && !collapsed}
          onClick={handleTabClick}
        />
      ))}
    </div>
  );

  return (
    <aside
      data-menu-zone="sidebar"
      className={`sidebar sidebar--${side}${collapsed ? " sidebar--collapsed" : ""}`}
      style={collapsed ? undefined : { width: clampWidth(active.defaultWidth) }}
    >
      {side === "left" && strip}
      {!collapsed && (
        <div className="sidebar-content">
          <Panel {...panelProps} />
        </div>
      )}
      {side === "right" && strip}
    </aside>
  );
}
