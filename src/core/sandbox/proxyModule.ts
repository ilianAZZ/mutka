import { ModuleRegistry } from "../module-registry/ModuleRegistry";
import type { MutkaAction, MutkaOpenHandler } from "../module-registry/module-registry.types";
import { SelectionStore } from "../stores/SelectionStore";
import { ClipboardStore } from "../stores/ClipboardStore";
import { ListingStore } from "../stores/ListingStore";
import { AppBridge } from "../app-bridge/AppBridge";
import { FileIconRegistry } from "../file-icons/FileIconRegistry";
import { evaluateWhen } from "./whenClause";
import { matchesItem } from "./itemMatch";
import { ColumnsRegistry } from "../columns/ColumnsRegistry";
import type { SandboxManifest, HostSnapshot, ColumnCell } from "./protocol";
import type { FileItem } from "../types";

/** Current serializable app state, handed to a command when it runs. */
export function appSnapshot(): HostSnapshot {
  return {
    selectedItems: SelectionStore.items,
    orderedItems: ListingStore.items,
    currentDirectory: AppBridge.getDirectory(),
    clipboard: ClipboardStore.state,
  };
}

export interface ProxyRuntime {
  /** Run a command in the backing runtime (worker or in-process). */
  run: (commandId: string, snapshot: HostSnapshot) => void;
  /** Run an open handler in the backing runtime. */
  runOpen: (handlerId: string, item: FileItem) => void;
  /** Produce a column's cell value for an item in the backing runtime. */
  runColumn: (columnId: string, item: FileItem) => Promise<ColumnCell | null>;
  /** Run a UI-event handler (button/list/form) in the backing runtime. */
  runUIEvent: (handlerId: string, value: unknown) => void;
  /** Tear down the backing runtime on unregister. */
  dispose: () => void;
}

/**
 * Surface a module's declared commands + open handlers to the rest of the app as
 * an ordinary MutkaModule, regardless of which runtime backs it. Each action /
 * handler proxies into the runtime; the runtime decides whether that crosses a
 * worker boundary or stays in-process.
 */
export function registerProxyModule(manifest: SandboxManifest, runtime: ProxyRuntime): void {
  const actions: MutkaAction[] = manifest.commands.map((c) => ({
    id: c.id,
    label: c.label,
    icon: c.icon,
    shortcut: c.shortcut,
    showInContextMenu: c.contextMenu ?? false,
    contextMenuCategory: c.contextMenuCategory,
    contextMenuZones: c.contextMenuZones,
    isVisible: c.when ? (ctx) => evaluateWhen(c.when!, ctx) : undefined,
    execute: () => runtime.run(c.id, appSnapshot()),
  }));

  const openHandlers: MutkaOpenHandler[] = manifest.openHandlers.map((h) => ({
    id: h.id,
    priority: h.priority,
    matches: (item) => matchesItem(h.match, item),
    handle: (item) => runtime.runOpen(h.handler, item),
  }));

  // Register file-type icon overrides. The registry validates each image
  // (data:image/ prefix, size cap) and ignores anything malformed.
  for (const contribution of manifest.fileIcons) {
    FileIconRegistry.register(manifest.id, contribution.extensions, contribution.image);
  }

  // Register custom columns. The registry owns directory/cell gating + caching;
  // it calls back into this runtime only to produce a value for a matching cell.
  ColumnsRegistry.register(manifest.id, manifest.columns, runtime.runColumn);

  // Declarative panels / settings sections carry only data; the React layer
  // wraps each in the core <DeclarativeView>, reading the UINode the module
  // renders into the matching UIStore surface. Tag each with its owning module.
  const declarativePanels = manifest.panels.map((p) => ({ ...p, moduleId: manifest.id }));
  const settingsSections = manifest.settingsSections.map((s) => ({ ...s, moduleId: manifest.id }));
  const moduleManagerButtons = manifest.moduleManagerButtons.map((b) => ({ ...b, moduleId: manifest.id }));

  ModuleRegistry.register({
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    permissions: manifest.permissions,
    actions,
    openHandlers,
    sidebarItems: manifest.sidebarItems,
    declarativePanels,
    settingsSections,
    moduleManagerButtons,
    runUIEvent: (handlerId, value) => runtime.runUIEvent(handlerId, value),
    onUnmount: () => {
      FileIconRegistry.unregister(manifest.id);
      ColumnsRegistry.unregister(manifest.id);
      runtime.dispose();
    },
  });
}
