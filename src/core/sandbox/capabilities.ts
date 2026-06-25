import { invoke } from "@tauri-apps/api/core";
import type { ModulePermission } from "../module-registry/module-registry.types";
import type { FileItem } from "../types";
import type { SortKey, SortState } from "../stores/listing.types";
import { AppBridge } from "../app-bridge/AppBridge";
import { TabManager } from "../tab-manager/TabManager";
import { FileSystemRegistry } from "../file-system/FileSystemRegistry";
import { SelectionStore } from "../stores/SelectionStore";
import { ListingStore } from "../stores/ListingStore";
import { ViewStore } from "../stores/ViewStore";
import { ModuleRegistry } from "../module-registry/ModuleRegistry";
import { DragService } from "../drag/DragService";

/**
 * THE GATEWAY VOCABULARY. Every privileged operation a module (built-in OR
 * community) may reach is listed here, mapped to the permission it requires and
 * the operation that fulfils it. `gateway.ts` checks the permission against the
 * module's manifest BEFORE running. This is the ONLY place modules' system
 * access is defined. To expose something new to modules, add it here.
 *
 * `fs.readDir`/`fs.openItem` route through FileSystemRegistry, so they work for
 * both local paths and provider schemes (e.g. nextcloud://). `run` receives the
 * calling module's id as its second argument (used by `config` for per-module
 * namespacing).
 */
export interface CapabilityDef {
  permission: ModulePermission;
  run: (args: unknown[], moduleId: string) => Promise<unknown>;
}

export type CapabilityTable = Record<string, Record<string, CapabilityDef>>;

const cfgKey = (moduleId: string, key: unknown): string => `mutka.modcfg.${moduleId}.${String(key)}`;

/** Decode a base64 string (from `read_file_base64`) into raw bytes. */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
/** Keychain service name for a module's secrets. Must match SettingsPanel's. */
export const secretService = (moduleId: string): string => `mutka.${moduleId}`;

export function createCapabilityTable(): CapabilityTable {
  return {
    fs: {
      readDir:      { permission: "fs:read",  run: ([p]) => FileSystemRegistry.readDir(p as string) },
      openItem:     { permission: "fs:read",  run: ([p]) => FileSystemRegistry.openItem(p as string) },
      readBytes:    { permission: "fs:read",  run: async ([p]) => base64ToBytes(await invoke<string>("read_file_base64", { path: p })) },
      cloudStatus:  { permission: "fs:read",  run: ([p]) => invoke("cloud_status", { path: p }) },
      deleteItem:   { permission: "fs:write", run: ([p]) => FileSystemRegistry.deleteItem(p as string) },
      renameItem:   { permission: "fs:write", run: ([from, to]) => FileSystemRegistry.renameItem(from as string, to as string) },
      createFile:   { permission: "fs:write", run: ([p]) => FileSystemRegistry.createFile(p as string) },
      createFolder: { permission: "fs:write", run: ([p]) => FileSystemRegistry.createFolder(p as string) },
      copyFiles:    { permission: "fs:write", run: ([paths, dest]) => FileSystemRegistry.copyFiles(paths as string[], dest as string) },
      moveFiles:    { permission: "fs:write", run: ([paths, dest]) => FileSystemRegistry.moveFiles(paths as string[], dest as string) },
    },
    board: {
      readFiles:  { permission: "clipboard:read",  run: () => invoke("clipboard_read_files") },
      writeFiles: { permission: "clipboard:write", run: ([paths, operation]) => invoke("clipboard_write_files", { paths, operation }) },
    },
    nav: {
      navigate:  { permission: "navigation", run: async ([p]) => AppBridge.nav.navigate(p as string) },
      goBack:    { permission: "navigation", run: async () => AppBridge.nav.goBack() },
      goForward: { permission: "navigation", run: async () => AppBridge.nav.goForward() },
      goUp:      { permission: "navigation", run: async () => AppBridge.nav.goUp() },
    },
    tabs: {
      openTab:             { permission: "navigation", run: async ([p]) => TabManager.openTab(p as string) },
      openTabInBackground: { permission: "navigation", run: async ([p]) => TabManager.openTabInBackground(p as string) },
      isActive:            { permission: "navigation", run: async () => TabManager.isActive() },
    },
    dialog: {
      prompt:  { permission: "dialog", run: ([opts]) => AppBridge.dialog.prompt(opts as Parameters<typeof AppBridge.dialog.prompt>[0]) },
      confirm: { permission: "dialog", run: ([opts]) => AppBridge.dialog.confirm(opts as Parameters<typeof AppBridge.dialog.confirm>[0]) },
      choose:  { permission: "dialog", run: ([opts]) => AppBridge.dialog.choose(opts as Parameters<typeof AppBridge.dialog.choose>[0]) },
    },
    net: {
      request:  { permission: "network", run: ([opts]) => invoke("http_request", { req: opts }) },
      download: { permission: "network", run: ([opts]) => invoke("http_download", { req: opts }) },
      upload:   { permission: "network", run: ([opts]) => invoke("http_upload", { req: opts }) },
    },
    config: {
      get: { permission: "storage", run: ([key], moduleId) => Promise.resolve(localStorage.getItem(cfgKey(moduleId, key))) },
      set: { permission: "storage", run: ([key, value], moduleId) => { localStorage.setItem(cfgKey(moduleId, key), String(value)); return Promise.resolve(null); } },
    },
    secrets: {
      get:    { permission: "secrets", run: ([key], moduleId) => invoke("secret_get", { service: secretService(moduleId), account: key }) },
      set:    { permission: "secrets", run: ([key, value], moduleId) => invoke("secret_set", { service: secretService(moduleId), account: key, password: value }) },
      delete: { permission: "secrets", run: ([key], moduleId) => invoke("secret_delete", { service: secretService(moduleId), account: key }) },
    },
    selection: {
      set: { permission: "view", run: async ([items]) => { SelectionStore.set(items as FileItem[]); return null; } },
    },
    view: {
      setSort:      { permission: "view", run: async ([sort]) => { ListingStore.setSort(sort as SortState); return null; } },
      toggleSort:   { permission: "view", run: async ([key]) => { ListingStore.toggleSort(key as SortKey); return null; } },
      toggleHidden: { permission: "view", run: async () => { ViewStore.toggleHidden(); return null; } },
      setShowHidden:{ permission: "view", run: async ([value]) => { ViewStore.setShowHidden(Boolean(value)); return null; } },
    },
    app: {
      refresh:  { permission: "fs:read",     run: async () => AppBridge.refresh() },
      // Run an item through the open-resolution pipeline (so any module's open
      // handler can claim it), the keyboard equivalent of a double-click.
      activate: { permission: "navigation",  run: async ([item]) => ModuleRegistry.resolveOpen(item as FileItem) },
    },
    sys: {
      homeDir:     { permission: "fs:read", run: () => invoke("get_home_dir") },
      quickLook:   { permission: "fs:read", run: ([p]) => invoke("quick_look", { path: p }) },
      // Refresh the live Quick Look panel to a new path (no-op unless it is open).
      previewUpdate: { permission: "fs:read", run: ([p]) => invoke("preview_update", { path: p }) },
      // Launch Services "Open With": list apps for a file, open a file with one.
      appsForFile: { permission: "fs:read", run: ([p]) => invoke("apps_for_file", { path: p }) },
      openWith:    { permission: "fs:read", run: ([p, app]) => invoke("open_with", { path: p, appPath: app }) },
      // Native OS file drag-out (drop on Finder/other apps moves the real files).
      startDrag:   { permission: "fs:read", run: ([paths, icon]) => DragService.start(paths as string[], icon as string | undefined) },
    },
  };
}
