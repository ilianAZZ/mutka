import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileItem, ActionContext, ClipboardState, DialogAPI } from "./core/types";
import { ModuleRegistry } from "./core/module-registry/ModuleRegistry";
import { EventBus } from "./core/event-bus/EventBus";
import { TabManager, type TabsSnapshot } from "./core/tab-manager/TabManager";
import { loadModules, loadCommunityModules } from "./moduleLoader";
import { InputManager } from "./core/input-manager/InputManager";
import { FileList } from "./components/FileList";
import { Breadcrumb } from "./components/Breadcrumb";
import { ContextMenu } from "./components/ContextMenu";
import { Dialog, type DialogState } from "./components/Dialog";
import { SettingsPanel } from "./components/SettingsPanel/SettingsPanel";
import "./styles/toolbar.css";

loadModules();
loadCommunityModules().catch((e) => console.error("[App] loadCommunityModules:", e));
InputManager.init();

function isClipboardState(data: unknown): data is ClipboardState {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    Array.isArray(d.items) &&
    (d.operation === "copy" || d.operation === "cut" || d.operation === null)
  );
}

export function App() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selected, setSelected] = useState<FileItem[]>([]);
  const [clipboard, setClipboard] = useState<ClipboardState>({ items: [], operation: null });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [flashedBtn, setFlashedBtn] = useState<"back" | "forward" | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Tab state (driven by TabManager via EventBus) ─────────────────────────────

  const [tabsSnap, setTabsSnap] = useState<TabsSnapshot>(() => TabManager.getSnapshot());

  useEffect(() => EventBus.on("tabs:changed", (d) => setTabsSnap(d as TabsSnapshot)), []);

  // ── Global navigation (used when no tab is active) ───────────────────────────

  const [globalDir, setGlobalDir] = useState<string>("/");
  const [globalHistory, setGlobalHistory] = useState<string[]>([]);
  const [globalHistoryIdx, setGlobalHistoryIdx] = useState<number>(-1);

  // Sync global nav to the last tab's location when all tabs are closed
  useEffect(() => {
    return EventBus.on("tabs:last-closed", (d) => {
      const { path } = d as { path: string };
      setGlobalDir(path);
      setGlobalHistory([path]);
      setGlobalHistoryIdx(0);
    });
  }, []);

  // Derive the current navigation context
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
  }), []);

  // ── EventBus subscriptions ───────────────────────────────────────────────────

  useEffect(() => {
    return EventBus.on("clipboard:changed", (data) => {
      if (isClipboardState(data)) setClipboard(data);
    });
  }, []);

  // ── Navigation ───────────────────────────────────────────────────────────────

  const navigateTo = useCallback((path: string) => {
    // Delegate to the active tab if one exists
    if (TabManager.navigateTo(path)) {
      setSelected([]);
      return;
    }
    const next = [...globalHistory.slice(0, globalHistoryIdx + 1), path];
    setGlobalHistory(next);
    setGlobalHistoryIdx(next.length - 1);
    setGlobalDir(path);
    setSelected([]);
  }, [globalHistory, globalHistoryIdx]);

  const goBack = useCallback(() => {
    if (TabManager.goBack()) { setSelected([]); return; }
    if (globalHistoryIdx > 0) {
      setGlobalHistoryIdx(globalHistoryIdx - 1);
      setGlobalDir(globalHistory[globalHistoryIdx - 1]);
      setSelected([]);
      EventBus.emit("navigation:back");
    }
  }, [globalHistoryIdx, globalHistory]);

  const goForward = useCallback(() => {
    if (TabManager.goForward()) { setSelected([]); return; }
    if (globalHistoryIdx < globalHistory.length - 1) {
      setGlobalHistoryIdx(globalHistoryIdx + 1);
      setGlobalDir(globalHistory[globalHistoryIdx + 1]);
      setSelected([]);
      EventBus.emit("navigation:forward");
    }
  }, [globalHistoryIdx, globalHistory]);

  const goUp = useCallback(() => {
    const parent = currentDir.split("/").slice(0, -1).join("/") || "/";
    if (parent !== currentDir) navigateTo(parent);
  }, [currentDir, navigateTo]);

  // ── File loading ─────────────────────────────────────────────────────────────

  useEffect(() => {
    invoke<string>("get_home_dir").then((home) => {
      const saved = localStorage.getItem("macows.lastDir") ?? home;
      navigateTo(saved);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async () => {
    try {
      const items = await invoke<FileItem[]>("read_dir", { path: currentDir });
      setFiles(items);
      localStorage.setItem("macows.lastDir", currentDir);
    } catch {
      setFiles([]);
    }
  }, [currentDir]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Action context ────────────────────────────────────────────────────────────

  const getContext = useCallback((): ActionContext => ({
    selectedItems: selected,
    currentDirectory: currentDir,
    clipboard,
    navigation: { navigate: navigateTo, goBack, goForward, goUp, canGoBack, canGoForward },
    refresh,
    dialog: dialogAPI,
  }), [selected, currentDir, clipboard, navigateTo, goBack, goForward, goUp, canGoBack, canGoForward, refresh, dialogAPI]);

  // ── Global effects ────────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = async (e: Event) => {
      const { actionId } = (e as CustomEvent<{ actionId: string }>).detail;
      await ModuleRegistry.executeAction(actionId, getContext());
    };
    document.addEventListener("macows:action", handler);
    return () => document.removeEventListener("macows:action", handler);
  }, [getContext]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "," && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowSettings((s) => !s);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const flash = (dir: "back" | "forward") => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      setFlashedBtn(dir);
      flashTimerRef.current = setTimeout(() => setFlashedBtn(null), 200);
    };
    const unsubBack = EventBus.on("navigation:back", () => flash("back"));
    const unsubForward = EventBus.on("navigation:forward", () => flash("forward"));
    return () => {
      unsubBack();
      unsubForward();
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleAction = useCallback((actionId: string) => {
    ModuleRegistry.executeAction(actionId, getContext());
  }, [getContext]);

  const handleModifierOpen = useCallback((item: FileItem, modifiers: { ctrl: boolean; meta: boolean }) => {
    EventBus.emit("file:modifier-open", { item, modifiers });
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div id="app" onContextMenu={handleContextMenu} onClick={() => setContextMenu(null)}>
      <div id="toolbar">
        <div className="toolbar-nav">
          <button
            className={`toolbar-btn${flashedBtn === "back" ? " toolbar-btn--flash" : ""}`}
            onClick={goBack}
            disabled={!canGoBack}
            title="Back (⌘[)"
          >‹</button>
          <button
            className={`toolbar-btn${flashedBtn === "forward" ? " toolbar-btn--flash" : ""}`}
            onClick={goForward}
            disabled={!canGoForward}
            title="Forward (⌘])"
          >›</button>
          <button className="toolbar-btn" onClick={goUp} title="Up">↑</button>
        </div>

        <Breadcrumb path={currentDir} onNavigate={navigateTo} />

        <div className="toolbar-actions">
          <button className="toolbar-btn" onClick={refresh} title="Refresh">↻</button>
          <button className="toolbar-btn" onClick={() => setShowSettings((s) => !s)} title="Settings (⌘,)">⚙</button>
        </div>
      </div>

      {ModuleRegistry.getTopBarPanels().map((panel) => {
        const Panel = panel.component;
        return <Panel key={panel.id} currentDirectory={currentDir} navigate={navigateTo} />;
      })}

      <FileList
        files={files}
        selected={selected}
        cutItems={clipboard.operation === "cut" ? clipboard.items : []}
        onSelect={setSelected}
        onOpen={(item) => ModuleRegistry.resolveOpen(item, getContext())}
        onModifierOpen={handleModifierOpen}
      />

      <div id="statusbar">
        <span>{files.length} item{files.length !== 1 ? "s" : ""}</span>
        {selected.length > 0 && <span> · {selected.length} selected</span>}
        {clipboard.operation && (
          <span> · {clipboard.items.length} in clipboard ({clipboard.operation})</span>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={ModuleRegistry.getContextMenuActions(getContext())}
          context={getContext()}
          onAction={handleAction}
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
