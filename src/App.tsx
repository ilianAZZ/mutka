import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ThemeManager } from "./core/theme-manager/ThemeManager";
import type { FileItem, BaseContext, ClipboardState, DialogAPI } from "./core/types";
import { ModuleRegistry } from "./core/module-registry/ModuleRegistry";
import { AppBridge } from "./core/app-bridge/AppBridge";
import { EventBus } from "./core/event-bus/EventBus";
import { Events } from "./core/event-bus/events";
import { TabManager, type TabsSnapshot } from "./core/tab-manager/TabManager";
import { FileSystemRegistry } from "./core/file-system/FileSystemRegistry";
import { DragService } from "./core/drag/DragService";
import { SelectionStore } from "./core/stores/SelectionStore";
import { ClipboardStore } from "./core/stores/ClipboardStore";
import { ListingStore } from "./core/stores/ListingStore";
import type { SortKey, ListingSnapshot } from "./core/stores/listing.types";
import { loadCommunityModules, loadBuiltinSandboxModules, loadDevModules } from "./moduleLoader";
import { InputManager } from "./core/input-manager/InputManager";
import { useColumns } from "./hooks/useColumns";
import { useColumnWidths } from "./hooks/useColumnWidths";
import { resolveMenuZone, isEditableElement, type MenuZone } from "./core/menu/menuZone";
import { FileList } from "./components/FileList/FileList";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { Places } from "./components/Places/Places";
import { TabBar } from "./components/TabBar/TabBar";
import type { MutkaSidebarPanel, SidebarPanelProps, SidebarItemGroup } from "./core/module-registry/module-registry.types";
import { Breadcrumb } from "./components/Breadcrumb/Breadcrumb";
import { ContextMenu } from "./components/ContextMenu/ContextMenu";
import { Dialog, type DialogState } from "./components/Dialog/Dialog";
import { SettingsPanel } from "./components/SettingsPanel/SettingsPanel";
import "./styles/toolbar.css";

loadBuiltinSandboxModules().catch((e) => console.error("[App] loadBuiltinSandboxModules:", e));
loadCommunityModules().catch((e) => console.error("[App] loadCommunityModules:", e));
loadDevModules().catch((e) => console.error("[App] loadDevModules:", e));
InputManager.init();

/** Read a dropped File as base64 (no data-URL prefix), for write_temp_file. */
function readFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function App() {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [homeDir, setHomeDir] = useState<string>("/");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; zone: MenuZone } | null>(null);
  const [flashedBtn, setFlashedBtn] = useState<"back" | "forward" | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── UI state derived from stores (for rendering only) ────────────────────────

  const [selected, setSelected] = useState<FileItem[]>(SelectionStore.items);
  const [clipboard, setClipboard] = useState<ClipboardState>(ClipboardStore.state);
  const [listing, setListing] = useState<ListingSnapshot>(() => ({ items: ListingStore.items, sort: ListingStore.sort }));

  useEffect(() => EventBus.on(Events.Selection.changed, ({ items }) => setSelected(items)), []);
  useEffect(() => EventBus.on(Events.Clipboard.changed, (state) => setClipboard(state)), []);
  useEffect(() => EventBus.on(Events.Listing.changed, (snap) => setListing(snap)), []);

  // ── Tab state ─────────────────────────────────────────────────────────────────

  const [tabsSnap, setTabsSnap] = useState<TabsSnapshot>(() => TabManager.getSnapshot());
  useEffect(() => EventBus.on(Events.Tabs.changed, (d) => setTabsSnap(d)), []);

  // ── Sidebar panels (contributed by modules, may load async) ──────────────────

  const [sidebarPanels, setSidebarPanels] = useState<MutkaSidebarPanel[]>(
    () => ModuleRegistry.getSidebarPanels()
  );
  const [sidebarItemGroups, setSidebarItemGroups] = useState<SidebarItemGroup[]>(
    () => ModuleRegistry.getSidebarItemGroups()
  );
  useEffect(() => {
    const refreshContributions = () => {
      setSidebarPanels(ModuleRegistry.getSidebarPanels());
      setSidebarItemGroups(ModuleRegistry.getSidebarItemGroups());
    };
    const unsubReg = EventBus.on(Events.Module.registered, refreshContributions);
    const unsubUnreg = EventBus.on(Events.Module.unregistered, refreshContributions);
    const unsubSidebar = EventBus.on(Events.Sidebar.changed, () =>
      setSidebarItemGroups(ModuleRegistry.getSidebarItemGroups())
    );
    return () => { unsubReg(); unsubUnreg(); unsubSidebar(); };
  }, []);

  const rightPanels = useMemo(
    () => sidebarPanels.filter((p) => p.side === "right"),
    [sidebarPanels]
  );

  const prevActiveTabIdRef = useRef(tabsSnap.activeTabId);
  useEffect(() => {
    if (prevActiveTabIdRef.current !== tabsSnap.activeTabId) {
      prevActiveTabIdRef.current = tabsSnap.activeTabId;
      SelectionStore.clear();
    }
  }, [tabsSnap.activeTabId]);

  // ── Global navigation (used when no tab is active) ───────────────────────────

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

  // ── Dialog API ───────────────────────────────────────────────────────────────

  const dialogAPI = useMemo((): DialogAPI => ({
    prompt: (options) => new Promise<string | null>((resolve) => {
      setDialogState({ type: "prompt", options, resolve });
    }),
    confirm: (options) => new Promise<boolean>((resolve) => {
      setDialogState({ type: "confirm", options, resolve });
    }),
    choose: (options) => new Promise<string | null>((resolve) => {
      setDialogState({ type: "choose", options, resolve });
    }),
  }), []);

  // ── Navigation ───────────────────────────────────────────────────────────────

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

  // ── File loading ─────────────────────────────────────────────────────────────

  useEffect(() => {
    invoke<string>("get_home_dir").then((home) => {
      setHomeDir(home);
      const saved = localStorage.getItem("mutka.lastDir");
      // Only restore a local path on launch; a remote (provider) path may not be
      // mounted yet, so fall back home.
      navigateTo(saved && saved.startsWith("/") ? saved : home);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async () => {
    try {
      const items = await FileSystemRegistry.readDir(currentDir);
      ListingStore.setItems(items);
      setLoadError(null);
      if (currentDir.startsWith("/")) localStorage.setItem("mutka.lastDir", currentDir);
    } catch (err) {
      console.error("[App] readDir failed:", err);
      ListingStore.setItems([]);
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, [currentDir]);

  useEffect(() => { refresh(); }, [refresh]);

  // Re-read the directory when a view preference (e.g. show-hidden) changes.
  useEffect(() => EventBus.on(Events.View.changed, () => { refresh(); }), [refresh]);

  // ── Connect ModuleRegistry (once) ────────────────────────────────────────────
  // Use a ref so the provider function always returns the latest nav/dialog state
  // without needing to re-register on every render.

  const appServicesRef = useRef({
    getDirectory: () => currentDir,
    getNavigation: () => ({ navigate: navigateTo, goBack, goForward, goUp, canGoBack, canGoForward }),
    refresh,
    dialog: dialogAPI,
  });

  appServicesRef.current = {
    getDirectory: () => currentDir,
    getNavigation: () => ({ navigate: navigateTo, goBack, goForward, goUp, canGoBack, canGoForward }),
    refresh,
    dialog: dialogAPI,
  };

  useEffect(() => {
    AppBridge.connect({
      getDirectory: () => appServicesRef.current.getDirectory(),
      getNavigation: () => appServicesRef.current.getNavigation(),
      getRefresh: () => appServicesRef.current.refresh,
      getDialog: () => appServicesRef.current.dialog,
    });
    ModuleRegistry.init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Settings shortcut ────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isEditableElement(e.target)) return;
      if (e.key === "," && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowSettings((s) => !s);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // ── Sync the native window appearance with the app theme ─────────────────────
  // The macOS NSVisualEffect vibrancy follows the WINDOW's appearance, not our
  // data-theme. Without this, a dark app theme on a light-appearance system shows a
  // light blurred material through the glass. Pushing the resolved theme to the native
  // window makes the vibrancy dark in dark mode, so the floating panes read as real glass.

  useEffect(() => {
    const sync = (resolved: "dark" | "light") => {
      getCurrentWindow().setTheme(resolved).catch(() => { /* non-macOS / no window */ });
    };
    sync(ThemeManager.getResolved());
    return EventBus.on(Events.Theme.changed, ({ resolved }) => sync(resolved));
  }, []);

  // ── Toolbar flash animation ──────────────────────────────────────────────────

  useEffect(() => {
    const flash = (dir: "back" | "forward") => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      setFlashedBtn(dir);
      flashTimerRef.current = setTimeout(() => setFlashedBtn(null), 200);
    };
    const unsubBack = EventBus.on(Events.Navigation.back, () => flash("back"));
    const unsubForward = EventBus.on(Events.Navigation.forward, () => flash("forward"));
    return () => {
      unsubBack();
      unsubForward();
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleContextMenu = (e: React.MouseEvent) => {
    const zone = resolveMenuZone(e.target);
    // Editable field → yield to the WebView's native menu (copy/paste in forms).
    if (zone === "editable") return;
    e.preventDefault();
    // No marked zone (chrome like the toolbar) falls back to the file background.
    setContextMenu({ x: e.clientX, y: e.clientY, zone: zone ?? "background" });
  };

  const handleModifierOpen = useCallback((item: FileItem, modifiers: { ctrl: boolean; meta: boolean }) => {
    EventBus.emit(Events.File.modifierOpen, { item, modifiers });
  }, []);

  const handleMiddleClick = useCallback((item: FileItem) => {
    // Folders → a module (tabs) opens them in a background tab. Files → system open.
    EventBus.emit(Events.File.middleOpen, { item });
    if (!item.isDir) ModuleRegistry.resolveOpen(item);
  }, []);

  const handleSortChange = useCallback((key: SortKey) => {
    ListingStore.toggleSort(key);
  }, []);

  const handleMoveItems = useCallback(async (paths: string[], dest: string) => {
    try {
      await FileSystemRegistry.moveFiles(paths, dest);
      SelectionStore.clear();
      refresh();
    } catch (err) {
      console.error("[App] moveFiles failed:", err);
    }
  }, [refresh]);

  // Prevent the WebView from navigating to a file dropped anywhere (white screen).
  // Folder rows handle their own drop; this just blocks the default everywhere else.
  useEffect(() => {
    const prevent = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  // Files dropped from Finder onto a folder: write each to a temp file, then
  // copy/upload-route it into the destination (local copy, or provider upload).
  const handleDropExternal = useCallback(async (fileList: FileList, dest: string) => {
    try {
      const temps: string[] = [];
      for (const file of Array.from(fileList)) {
        const base64 = await readFileBase64(file);
        temps.push(await invoke<string>("write_temp_file", { filename: file.name, contentBase64: base64 }));
      }
      await FileSystemRegistry.copyFiles(temps, dest);
      refresh();
    } catch (err) {
      console.error("[App] drop import failed:", err);
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, [refresh]);

  // Shared props handed to every module-contributed sidebar panel
  const panelProps: SidebarPanelProps = {
    selectedItems: selected,
    currentDirectory: currentDir,
    navigate: navigateTo,
    refresh,
  };

  // BaseContext for ContextMenu isEnabled/isVisible checks (read-only, no services)
  const viewCtx: BaseContext = {
    selectedItems: selected,
    currentDirectory: currentDir,
    clipboard,
    navigation: { navigate: navigateTo, goBack, goForward, goUp, canGoBack, canGoForward },
  };

  // Module-contributed list columns that apply to the current directory.
  const { columns: extraColumns, cellData: columnCells } = useColumns(listing.items, currentDir, homeDir);
  const { widths: columnWidths, setWidth: handleColumnResize } = useColumnWidths();

  // Actions for the zone the user right-clicked. Empty → no menu is shown.
  const menuGroups = contextMenu
    ? ModuleRegistry.getContextMenuActions(viewCtx, contextMenu.zone)
    : [];

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div id="app" onContextMenu={handleContextMenu} onClick={() => setContextMenu(null)}>
      <Places
        groups={sidebarItemGroups}
        homeDir={homeDir}
        currentDir={currentDir}
        onNavigate={navigateTo}
        onRunCommand={(id) => ModuleRegistry.executeAction(id)}
        onRemoveItem={(id) => EventBus.emit(Events.Sidebar.itemRemove, { id })}
      />

      <div id="main-col">
      <div id="toolbar">
        <div className="toolbar-nav">
          <div className="toolbar-segment">
            <button
              className={`seg-btn${flashedBtn === "back" ? " seg-btn--flash" : ""}`}
              onClick={goBack}
              disabled={!canGoBack}
              title="Back (⌘[)"
            >‹</button>
            <span className="seg-divider" />
            <button
              className={`seg-btn${flashedBtn === "forward" ? " seg-btn--flash" : ""}`}
              onClick={goForward}
              disabled={!canGoForward}
              title="Forward (⌘])"
            >›</button>
          </div>
          <button className="toolbar-btn" onClick={goUp} title="Up">↑</button>
        </div>

        <Breadcrumb path={currentDir} onNavigate={navigateTo} />

        <div className="toolbar-actions">
          <button className="toolbar-btn" onClick={refresh} title="Refresh">↻</button>
          <button className="toolbar-btn" onClick={() => setShowSettings((s) => !s)} title="Settings (⌘,)">⚙</button>
        </div>
      </div>

      <TabBar />

      <div id="content-row">
        <FileList
          files={listing.items}
          selected={selected}
          cutItems={clipboard.operation === "cut" ? clipboard.items : []}
          sort={listing.sort}
          error={loadError}
          currentDir={currentDir}
          extraColumns={extraColumns}
          cellData={columnCells}
          columnWidths={columnWidths}
          onColumnResize={handleColumnResize}
          onSelect={(items) => SelectionStore.set(items)}
          onOpen={(item) => ModuleRegistry.resolveOpen(item)}
          onSortChange={handleSortChange}
          onModifierOpen={handleModifierOpen}
          onMiddleClick={handleMiddleClick}
          onMoveItems={handleMoveItems}
          onDropExternal={handleDropExternal}
          onNativeDrag={(items) => DragService.startForItems(items)}
        />

        <Sidebar side="right" panels={rightPanels} panelProps={panelProps} />
      </div>

      <div id="statusbar">
        <span>{listing.items.length} item{listing.items.length !== 1 ? "s" : ""}</span>
        {selected.length > 0 && <span> · {selected.length} selected</span>}
        {clipboard.operation && (
          <span> · {clipboard.items.length} in clipboard ({clipboard.operation})</span>
        )}
      </div>
      </div>

      {contextMenu && menuGroups.length > 0 && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          groups={menuGroups}
          context={viewCtx}
          onAction={(actionId) => ModuleRegistry.executeAction(actionId)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      {dialogState && (
        <Dialog
          state={dialogState}
          onClose={() => setDialogState(null)}
        />
      )}
    </div>
  );
}
