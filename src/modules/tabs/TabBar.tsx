import { useState, useEffect } from "react";
import { EventBus } from "../../core/event-bus/EventBus";
import { TabManager, type TabsSnapshot } from "../../core/tab-manager/TabManager";
import type { TopBarPanelProps } from "../../core/module-registry/module-registry.types";
import "./TabBar.css";

export function TabBar(_props: TopBarPanelProps) {
  const [snap, setSnap] = useState<TabsSnapshot>(() => TabManager.getSnapshot());

  useEffect(() => EventBus.on("tabs:changed", (d) => setSnap(d as TabsSnapshot)), []);

  if (snap.tabs.length < 2) return null;

  return (
    <div className="tab-bar" role="tablist">
      {snap.tabs.map((tab, i) => {
        const isActive = tab.id === snap.activeTabId;
        const prevIsActive = i > 0 && snap.tabs[i - 1].id === snap.activeTabId;
        return (
          <div key={tab.id} className="tab-slot">
            {i > 0 && !isActive && !prevIsActive && <div className="tab-sep" />}
            <button
              role="tab"
              aria-selected={isActive}
              className={`tab${isActive ? " tab--active" : ""}`}
              onClick={() => TabManager.switchTab(tab.id)}
              title={tab.path}
            >
              <span className="tab-icon">📁</span>
              <span className="tab-label">{tab.label}</span>
              <span
                className="tab-close"
                onClick={(e) => { e.stopPropagation(); TabManager.closeTab(tab.id); }}
                role="button"
                aria-label="Close tab"
              >×</span>
            </button>
          </div>
        );
      })}
      <button
        className="tab-new"
        onClick={() => TabManager.openTab(snap.currentPath ?? "/")}
        title="New Tab (⌘T)"
      >+</button>
    </div>
  );
}
