import { EventBus } from "../event-bus/EventBus";
import type { TabBarTab, TabsSnapshot } from "./tab-manager.types";

export type { TabBarTab, TabsSnapshot };

// ─── Internal representation ───────────────────────────────────────────────────

interface InternalTab {
  id: number;
  label: string;
  history: string[];
  historyIdx: number;
}

// ─── Singleton ────────────────────────────────────────────────────────────────

// Emitted events:
//   "tabs:changed"      TabsSnapshot    — after any state mutation
//   "tabs:last-closed"  { path: string } — when the final tab is closed
//   "navigation:back"                   — when goBack() succeeds (for toolbar flash)
//   "navigation:forward"                — when goForward() succeeds

class TabManagerClass {
  private tabs: InternalTab[] = [];
  private activeTabId: number | null = null;
  private idCounter = 0;

  private get active(): InternalTab | null {
    return this.tabs.find((t) => t.id === this.activeTabId) ?? null;
  }

  isActive(): boolean {
    return this.activeTabId !== null;
  }

  getSnapshot(): TabsSnapshot {
    const a = this.active;
    return {
      tabs: this.tabs.map((t) => ({
        id: t.id,
        label: t.label,
        path: t.history[t.historyIdx],
      })),
      activeTabId: this.activeTabId,
      currentPath: a ? a.history[a.historyIdx] : null,
      canGoBack: a ? a.historyIdx > 0 : false,
      canGoForward: a ? a.historyIdx < a.history.length - 1 : false,
    };
  }

  private emit(): void {
    EventBus.emit("tabs:changed", this.getSnapshot());
  }

  openTab(path: string): void {
    const id = this.idCounter++;
    const label = path.split("/").pop() || "/";
    this.tabs = [...this.tabs, { id, label, history: [path], historyIdx: 0 }];
    this.activeTabId = id;
    this.emit();
  }

  closeTab(id: number): void {
    const closing = this.tabs.find((t) => t.id === id);
    const remaining = this.tabs.filter((t) => t.id !== id);

    if (remaining.length === 0) {
      this.tabs = [];
      this.activeTabId = null;
      if (closing) {
        EventBus.emit("tabs:last-closed", { path: closing.history[closing.historyIdx] });
      }
    } else {
      if (this.activeTabId === id) {
        const idx = this.tabs.findIndex((t) => t.id === id);
        this.activeTabId = remaining[Math.min(idx, remaining.length - 1)].id;
      }
      this.tabs = remaining;
    }
    this.emit();
  }

  switchTab(id: number): void {
    if (!this.tabs.some((t) => t.id === id)) return;
    this.activeTabId = id;
    this.emit();
  }

  /** Navigate the active tab. Returns false when no tab is active. */
  navigateTo(path: string): boolean {
    if (this.activeTabId === null) return false;
    this.tabs = this.tabs.map((tab) => {
      if (tab.id !== this.activeTabId) return tab;
      const next = [...tab.history.slice(0, tab.historyIdx + 1), path];
      return { ...tab, label: path.split("/").pop() || "/", history: next, historyIdx: next.length - 1 };
    });
    this.emit();
    return true;
  }

  /** Go back in the active tab's history. Returns false when not possible. */
  goBack(): boolean {
    const a = this.active;
    if (!a || a.historyIdx <= 0) return false;
    this.tabs = this.tabs.map((tab) =>
      tab.id !== this.activeTabId ? tab : { ...tab, historyIdx: tab.historyIdx - 1 }
    );
    this.emit();
    EventBus.emit("navigation:back");
    return true;
  }

  /** Go forward in the active tab's history. Returns false when not possible. */
  goForward(): boolean {
    const a = this.active;
    if (!a || a.historyIdx >= a.history.length - 1) return false;
    this.tabs = this.tabs.map((tab) =>
      tab.id !== this.activeTabId ? tab : { ...tab, historyIdx: tab.historyIdx + 1 }
    );
    this.emit();
    EventBus.emit("navigation:forward");
    return true;
  }
}

export const TabManager = new TabManagerClass();
