import { useState, useEffect } from "react";
import { EventBus } from "../../core/event-bus/EventBus";
import { Events } from "../../core/event-bus/events";
import { TabManager, type TabsSnapshot } from "../../core/tab-manager/TabManager";
import "./TabBar.css";

// Core tab strip. Driven entirely by TabManager (single source of truth for
// tabs). The `core.tabs` module contributes the commands/shortcuts that open
// tabs; this component just renders the current tab state and wires clicks.
export function TabBar() {
  const [snap, setSnap] = useState<TabsSnapshot>(() => TabManager.getSnapshot());

  useEffect(() => EventBus.on(Events.Tabs.changed, (d) => setSnap(d)), []);

  if (!snap.tabs.length) return null;

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
              onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); TabManager.closeTab(tab.id); } }}
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
