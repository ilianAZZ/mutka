/** View-model for a single tab (sent in snapshots, used by TabBar). */
export interface TabBarTab {
  id: number;
  /** Displayed name (current folder name of this tab) */
  label: string;
  /** Current directory of this tab. */
  path: string;
}

/**
 * Snapshot of the tab system emitted on every state change.
 * App.tsx subscribes to "tabs:changed" and stores this in React state
 * so the UI can re-render without knowing anything about tab internals.
 */
export interface TabsSnapshot {
  tabs: TabBarTab[];
  activeTabId: number | null;
  /** Current directory of the active tab. null when no tabs are open. */
  currentPath: string | null;
  canGoBack: boolean;
  canGoForward: boolean;
}
