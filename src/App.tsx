import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileItem, ActionContext, ClipboardState, DialogAPI } from "./core/types";
import { ModuleRegistry } from "./core/ModuleRegistry";
import { EventBus } from "./core/EventBus";
import { loadModules, loadCommunityModules } from "./moduleLoader";
import { InputManager } from "./core/InputManager";
import { FileList } from "./components/FileList";
import { Breadcrumb } from "./components/Breadcrumb";
import { ContextMenu } from "./components/ContextMenu";
import { Dialog, type DialogState } from "./components/Dialog";
import { SettingsPanel } from "./components/SettingsPanel/SettingsPanel";
import "./styles/toolbar.css";

// Auto-discover and register all modules in src/modules/*/index.ts.
// core.navigation is first so its priority-0 open handlers are in place
// before any other module registers higher-priority overrides.
loadModules();
// Community modules load async after built-ins — registered before the user can interact
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
  const [currentDir, setCurrentDir] = useState<string>("/");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selected, setSelected] = useState<FileItem[]>([]);
  const [clipboard, setClipboard] = useState<ClipboardState>({ items: [], operation: null });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [flashedBtn, setFlashedBtn] = useState<"back" | "forward" | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable DialogAPI — setDialogState is always the same reference so no deps needed
  const dialogAPI = useMemo((): DialogAPI => ({
    prompt: (options) => new Promise<string | null>((resolve) => {
      setDialogState({ type: "prompt", options, resolve });
    }),
    confirm: (options) => new Promise<boolean>((resolve) => {
      setDialogState({ type: "confirm", options, resolve });
    }),
  }), []);

  // Sync clipboard React state from EventBus — clipboard module emits after every copy/cut/paste
  useEffect(() => {
    return EventBus.on("clipboard:changed", (data) => {
      if (isClipboardState(data)) setClipboard(data);
    });
  }, []);

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

  const navigateTo = useCallback((path: string) => {
    setHistory((prev) => {
      const next = [...prev.slice(0, historyIdx + 1), path];
      setHistoryIdx(next.length - 1);
      return next;
    });
    setCurrentDir(path);
    setSelected([]);
  }, [historyIdx]);

  const goBack = useCallback(() => {
    if (historyIdx > 0) {
      const path = history[historyIdx - 1];
      setHistoryIdx(historyIdx - 1);
      setCurrentDir(path);
      setSelected([]);
      EventBus.emit("navigation:back");
    }
  }, [historyIdx, history]);

  const goForward = useCallback(() => {
    if (historyIdx < history.length - 1) {
      const path = history[historyIdx + 1];
      setHistoryIdx(historyIdx + 1);
      setCurrentDir(path);
      setSelected([]);
      EventBus.emit("navigation:forward");
    }
  }, [historyIdx, history]);

  const goUp = useCallback(() => {
    const parent = currentDir.split("/").slice(0, -1).join("/") || "/";
    if (parent !== currentDir) navigateTo(parent);
  }, [currentDir, navigateTo]);

  // Top bar panels (e.g. tab bar) can request navigation via this event
  useEffect(() => {
    return EventBus.on("tabs:navigate", (data) => {
      const { path } = data as { path: string };
      navigateTo(path);
    });
  }, [navigateTo]);

  const handleModifierOpen = useCallback((item: FileItem, modifiers: { ctrl: boolean; meta: boolean }) => {
    EventBus.emit("file:modifier-open", { item, modifiers });
  }, []);

  const getContext = useCallback((): ActionContext => ({
    selectedItems: selected,
    currentDirectory: currentDir,
    clipboard,
    navigation: {
      navigate: navigateTo,
      goBack,
      goForward,
      goUp,
      canGoBack: historyIdx > 0,
      canGoForward: historyIdx < history.length - 1,
    },
    refresh,
    dialog: dialogAPI,
  }), [selected, currentDir, clipboard, navigateTo, goBack, goForward, goUp, historyIdx, history.length, refresh, dialogAPI]);

  // Route keyboard shortcut actions through ModuleRegistry (async, error-isolated per module)
  useEffect(() => {
    const handler = async (e: Event) => {
      const { actionId } = (e as CustomEvent<{ actionId: string }>).detail;
      await ModuleRegistry.executeAction(actionId, getContext());
    };
    document.addEventListener("macows:action", handler);
    return () => document.removeEventListener("macows:action", handler);
  }, [getContext]);

  // ⌘, to toggle settings
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

  // Toolbar button flash animation on navigation events
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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleAction = useCallback((actionId: string) => {
    ModuleRegistry.executeAction(actionId, getContext());
  }, [getContext]);

  return (
    <div id="app" onContextMenu={handleContextMenu} onClick={() => setContextMenu(null)}>
      <div id="toolbar">
        <div className="toolbar-nav">
          <button
            className={`toolbar-btn${flashedBtn === "back" ? " toolbar-btn--flash" : ""}`}
            onClick={goBack}
            disabled={historyIdx <= 0}
            title="Back (⌘[)"
          >‹</button>
          <button
            className={`toolbar-btn${flashedBtn === "forward" ? " toolbar-btn--flash" : ""}`}
            onClick={goForward}
            disabled={historyIdx >= history.length - 1}
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
