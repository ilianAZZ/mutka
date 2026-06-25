import { useCallback, useEffect, useRef, useState } from "react";
import { EventBus } from "../core/event-bus/EventBus";
import { Events } from "../core/event-bus/events";
import { TabManager, type TabsSnapshot } from "../core/tab-manager/TabManager";
import { SelectionStore } from "../core/stores/SelectionStore";

export interface Navigation {
  tabsSnap: TabsSnapshot;
  currentDir: string;
  canGoBack: boolean;
  canGoForward: boolean;
  navigateTo: (path: string) => void;
  goBack: () => void;
  goForward: () => void;
  goUp: () => void;
}

/**
 * Owns directory navigation. When a tab is active, TabManager is the source of
 * truth; otherwise a global history (used after the last tab closes) takes over.
 * Every navigation clears the selection.
 */
export function useNavigation(): Navigation {
  const [tabsSnap, setTabsSnap] = useState<TabsSnapshot>(() => TabManager.getSnapshot());
  useEffect(() => EventBus.on(Events.Tabs.changed, (d) => setTabsSnap(d)), []);

  // Clear selection when the active tab changes.
  const prevActiveTabIdRef = useRef(tabsSnap.activeTabId);
  useEffect(() => {
    if (prevActiveTabIdRef.current !== tabsSnap.activeTabId) {
      prevActiveTabIdRef.current = tabsSnap.activeTabId;
      SelectionStore.clear();
    }
  }, [tabsSnap.activeTabId]);

  // ── Global navigation (used when no tab is active) ──────────────────────────
  const [globalDir, setGlobalDir] = useState<string>("/");
  const [globalHistory, setGlobalHistory] = useState<string[]>([]);
  const [globalHistoryIdx, setGlobalHistoryIdx] = useState<number>(-1);

  useEffect(() => {
    return EventBus.on(Events.Tabs.lastClosed, ({ path }) => {
      setGlobalDir(path);
      setGlobalHistory([path]);
      setGlobalHistoryIdx(0);
    });
  }, []);

  const currentDir = tabsSnap.currentPath ?? globalDir;
  const canGoBack = tabsSnap.activeTabId !== null ? tabsSnap.canGoBack : globalHistoryIdx > 0;
  const canGoForward = tabsSnap.activeTabId !== null
    ? tabsSnap.canGoForward
    : globalHistoryIdx < globalHistory.length - 1;

  const navigateTo = useCallback((path: string) => {
    if (TabManager.navigateTo(path)) { SelectionStore.clear(); return; }
    const next = [...globalHistory.slice(0, globalHistoryIdx + 1), path];
    setGlobalHistory(next);
    setGlobalHistoryIdx(next.length - 1);
    setGlobalDir(path);
    SelectionStore.clear();
  }, [globalHistory, globalHistoryIdx]);

  const goBack = useCallback(() => {
    if (TabManager.goBack()) { SelectionStore.clear(); return; }
    if (globalHistoryIdx > 0) {
      setGlobalHistoryIdx(globalHistoryIdx - 1);
      setGlobalDir(globalHistory[globalHistoryIdx - 1]);
      SelectionStore.clear();
      EventBus.emit(Events.Navigation.back);
    }
  }, [globalHistoryIdx, globalHistory]);

  const goForward = useCallback(() => {
    if (TabManager.goForward()) { SelectionStore.clear(); return; }
    if (globalHistoryIdx < globalHistory.length - 1) {
      setGlobalHistoryIdx(globalHistoryIdx + 1);
      setGlobalDir(globalHistory[globalHistoryIdx + 1]);
      SelectionStore.clear();
      EventBus.emit(Events.Navigation.forward);
    }
  }, [globalHistoryIdx, globalHistory]);

  const goUp = useCallback(() => {
    const parent = currentDir.split("/").slice(0, -1).join("/") || "/";
    if (parent !== currentDir) navigateTo(parent);
  }, [currentDir, navigateTo]);

  return { tabsSnap, currentDir, canGoBack, canGoForward, navigateTo, goBack, goForward, goUp };
}
