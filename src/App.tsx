import { useCallback, useEffect, useState } from "react";
import type { FileItem, BaseContext } from "./core/types";
import { ModuleRegistry } from "./core/module-registry/ModuleRegistry";
import { EventBus } from "./core/event-bus/EventBus";
import { Events } from "./core/event-bus/events";
import { FileSystemRegistry } from "./core/file-system/FileSystemRegistry";
import { FileIconRegistry } from "./core/file-icons/FileIconRegistry";
import { DragService } from "./core/drag/DragService";
import { SelectionStore } from "./core/stores/SelectionStore";
import { SettingsStore } from "./core/stores/SettingsStore";
import { ModulesStore } from "./core/stores/ModulesStore";
import { ListingStore } from "./core/stores/ListingStore";
import type { SortKey } from "./core/stores/listing.types";
import { ModuleManager } from "./module-manager/ModuleManager";
import { InputManager } from "./core/input-manager/InputManager";
import { DirectoryWatcher } from "./core/file-watch/DirectoryWatcher";
import { useColumns } from "./hooks/useColumns";
import { useColumnWidths } from "./hooks/useColumnWidths";
import { useStoreSnapshots } from "./hooks/useStoreSnapshots";
import { useNavigation } from "./hooks/useNavigation";
import { useDirectoryListing } from "./hooks/useDirectoryListing";
import { useSidebarContributions } from "./hooks/useSidebarContributions";
import { useDialog } from "./hooks/useDialog";
import { useToolbarFlash } from "./hooks/useToolbarFlash";
import { useNativeThemeSync } from "./hooks/useNativeThemeSync";
import { useExternalDropGuard } from "./hooks/useExternalDropGuard";
import { useAppBridge } from "./hooks/useAppBridge";
import { resolveMenuZone, type MenuZone } from "./core/menu/menuZone";
import { FileBrowser } from "./components/FileBrowser/FileBrowser";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { TabBar } from "./components/TabBar/TabBar";
import { Toolbar } from "./components/Toolbar/Toolbar";
import type { SidebarPanelProps } from "./core/module-registry/module-registry.types";
import { ContextMenu } from "./components/ContextMenu/ContextMenu";
import { Dialog } from "./components/Dialog/Dialog";
import { FilePickerModal } from "./components/FilePicker/FilePickerModal";
import { SettingsPanel } from "./components/SettingsPanel/SettingsPanel";
import { ModulesPanel } from "./components/ModulesPanel/ModulesPanel";
import { StatusBar } from "./components/StatusBar/StatusBar";
import { DeclarativeModal } from "./components/Declarative/DeclarativeModal";
import { UpdateToast } from "./components/UpdateToast/UpdateToast";
import { NotificationToasts } from "./components/Notifications/NotificationToasts";
import { NotificationStore } from "./core/stores/NotificationStore";
import { useActiveModal } from "./hooks/useActiveModal";
import { outputPickerResult } from "./core/cli/CliHandler";
import "./styles/toolbar.css";

// Resolves once every enabled module is registered, so `app:ready` (the launch
// hook modules listen to) fires only after their event subscriptions are wired.
// ModuleManager owns discovery + lifecycle (enable/disable/install at runtime).
const modulesReady = ModuleManager.init().catch((e) => console.error("[App] ModuleManager.init:", e));
InputManager.init();
DirectoryWatcher.init();
NotificationStore.init();
// Warm the icon cache from disk so previously-seen file types render instantly
// on the first folder open (no IPC, no placeholder flash).
void FileIconRegistry.preload();

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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; zone: MenuZone } | null>(null);

  // ── State derived from stores + subsystems (one hook per concern) ────────────
  const { homeDir, showSettings, showModules, selected, clipboard, listing } = useStoreSnapshots();
  const { currentDir, canGoBack, canGoForward, navigateTo, goBack, goForward, goUp } = useNavigation();
  const { refresh, loadError } = useDirectoryListing(currentDir);
  const { rightPanels, sidebarItemGroups } = useSidebarContributions();
  const { dialogAPI, dialogState, closeDialog, pickerState } = useDialog();
  const flashedBtn = useToolbarFlash();
  const activeModal = useActiveModal();

  // ── Side-effect-only hooks ───────────────────────────────────────────────────
  useNativeThemeSync();
  useExternalDropGuard();

  // CLI event handlers: `mutka <path>` navigates, `mutka --picker` opens the picker.
  useEffect(() => {
    const unsubNav = EventBus.on(Events.Cli.navigate, ({ path }) => navigateTo(path));
    const unsubPicker = EventBus.on(Events.Cli.picker, () => {
      dialogAPI.pickFile({ title: "Pick a file or folder", mode: "any" }).then(outputPickerResult);
    });
    return () => { unsubNav(); unsubPicker(); };
  }, [navigateTo, dialogAPI]);
  useAppBridge({
    getDirectory: () => currentDir,
    getNavigation: () => ({ navigate: navigateTo, goBack, goForward, goUp, canGoBack, canGoForward }),
    refresh,
    dialog: dialogAPI,
  }, modulesReady);

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

  // Files dropped from Finder onto a folder. Reading the dropped File objects to
  // base64 is a DOM concern (kept here); the privileged import — temp files +
  // copy/upload-routing into the destination — is feature logic owned by the
  // `core.drop-import` module, reached via this event.
  const handleDropExternal = useCallback(async (fileList: FileList, dest: string) => {
    try {
      const files = await Promise.all(
        Array.from(fileList).map(async (file) => ({ name: file.name, base64: await readFileBase64(file) }))
      );
      EventBus.emit(Events.File.externalDrop, { files, dest });
    } catch (err) {
      console.error("[App] drop import failed:", err);
    }
  }, []);

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
      <FileBrowser
        places={{
          groups: sidebarItemGroups,
          homeDir,
          currentDir,
          onNavigate: navigateTo,
          onRunCommand: (id) => ModuleRegistry.executeAction(id),
          onRemoveItem: (id) => EventBus.emit(Events.Sidebar.itemRemove, { id }),
        }}
        header={
          <>
            <Toolbar
              currentDir={currentDir}
              flashedBtn={flashedBtn}
              canGoBack={canGoBack}
              canGoForward={canGoForward}
              onNavigate={navigateTo}
              onBack={goBack}
              onForward={goForward}
              onUp={goUp}
              onRefresh={refresh}
              onOpenModules={() => ModulesStore.setOpen(true)}
              onOpenSettings={() => ModuleRegistry.executeAction("core.settings.toggle")}
            />
            <TabBar />
          </>
        }
        fileList={{
          files: listing.items,
          selected,
          cutItems: clipboard.operation === "cut" ? clipboard.items : [],
          sort: listing.sort,
          error: loadError,
          currentDir,
          extraColumns,
          cellData: columnCells,
          columnWidths,
          onColumnResize: handleColumnResize,
          onSelect: (items) => SelectionStore.set(items),
          onOpen: (item) => ModuleRegistry.resolveOpen(item),
          onSortChange: handleSortChange,
          onModifierOpen: handleModifierOpen,
          onMiddleClick: handleMiddleClick,
          onMoveItems: handleMoveItems,
          onDropExternal: handleDropExternal,
          onNativeDrag: (items) => DragService.startForItems(items),
          onRendered: (count) => EventBus.emit(Events.Listing.rendered, { path: currentDir, count }),
        }}
        right={<Sidebar side="right" panels={rightPanels} panelProps={panelProps} />}
        footer={
          <StatusBar
            itemCount={listing.items.length}
            selectedCount={selected.length}
            clipboard={clipboard}
          />
        }
      />

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

      {showSettings && <SettingsPanel onClose={() => SettingsStore.setOpen(false)} />}

      {showModules && <ModulesPanel onClose={() => ModulesStore.setOpen(false)} />}

      {dialogState && <Dialog state={dialogState} onClose={closeDialog} />}

      {pickerState && (
        <FilePickerModal
          options={pickerState.options}
          initialDir={pickerState.options.initialDir ?? currentDir}
          onPick={pickerState.resolve}
        />
      )}

      {activeModal && <DeclarativeModal moduleId={activeModal.moduleId} node={activeModal.node} />}

      <UpdateToast />
      <NotificationToasts />
    </div>
  );
}
