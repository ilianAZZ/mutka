import { ModuleRegistry } from "../module-registry/ModuleRegistry";
import type { MutkaAction, MutkaOpenHandler } from "../module-registry/module-registry.types";
import { SelectionStore } from "../stores/SelectionStore";
import { ClipboardStore } from "../stores/ClipboardStore";
import { ListingStore } from "../stores/ListingStore";
import { AppBridge } from "../app-bridge/AppBridge";
import { FileIconRegistry } from "../file-icons/FileIconRegistry";
import { evaluateWhen } from "./whenClause";
import type { SandboxManifest, HostSnapshot, SandboxOpenMatch } from "./protocol";
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

function matchesItem(match: SandboxOpenMatch, item: FileItem): boolean {
  if (match.isDir !== undefined && item.isDir !== match.isDir) return false;
  if (match.isPackage !== undefined && item.isPackage !== match.isPackage) return false;
  if (match.extensions && !match.extensions.includes((item.extension ?? "").toLowerCase())) return false;
  return true;
}

export interface ProxyRuntime {
  /** Run a command in the backing runtime (worker or in-process). */
  run: (commandId: string, snapshot: HostSnapshot) => void;
  /** Run an open handler in the backing runtime. */
  runOpen: (handlerId: string, item: FileItem) => void;
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

  ModuleRegistry.register({
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    permissions: manifest.permissions,
    actions,
    openHandlers,
    sidebarItems: manifest.sidebarItems,
    onUnmount: () => {
      FileIconRegistry.unregister(manifest.id);
      runtime.dispose();
    },
  });
}
