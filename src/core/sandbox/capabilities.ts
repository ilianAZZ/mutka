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
import { HomeStore } from "../stores/HomeStore";
import { SettingsStore } from "../stores/SettingsStore";
import { ModulesStore } from "../stores/ModulesStore";
import { UIStore } from "../stores/UIStore";
import { StatusBarStore } from "../stores/StatusBarStore";
import { ModuleRegistry } from "../module-registry/ModuleRegistry";
import { DragService } from "../drag/DragService";
import { probeManifest } from "./probeManifest";
import type { UINode, StatusBarItem } from "./protocol";

/** localStorage key for the last visited local directory (restored at launch). */
export const LAST_DIR_KEY = "mutka.lastDir";

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
  /** The permission this capability needs — or, as an array, ANY one of them. */
  permission: ModulePermission | ModulePermission[];
  run: (args: unknown[], moduleId: string, permissions: readonly ModulePermission[]) => Promise<unknown>;
}

export type CapabilityTable = Record<string, Record<string, CapabilityDef>>;

// Namespace a module's config entry. The id↔key delimiter is ":" — NOT "." —
// because a module id may itself contain dots (`com.acme.vault`), so a "." here
// would let module "com" reach "com.acme.vault"'s keys via key "acme.vault.<k>"
// (their joined strings would be identical). ":" can't appear in an id, so the
// segment up to the first ":" is unambiguously the id → no cross-module collision.
const cfgKey = (moduleId: string, key: unknown): string => `mutka.modcfg.${moduleId}:${String(key)}`;

/** Decode a base64 string (from `read_file_base64`) into raw bytes. */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
/** Encode raw bytes to base64 for the IPC bridge (chunked to avoid a huge spread). */
function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/** Options accepted by the `net.request` capability (the module-facing shape). */
interface NetRequestOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  /** Text (UTF-8) or raw bytes; the gateway base64-encodes either for transport. */
  body?: string | Uint8Array;
}
/** What `net.request` resolves to (decoded host-side from the Rust response). */
interface NetResponse {
  status: number;
  headers: Record<string, string>;
  /** Body decoded as UTF-8 text (use for JSON/XML/text APIs). */
  body: string;
  /** Body as raw bytes (use for binary downloads). */
  bytes: Uint8Array;
}

/**
 * The single network primitive. Pure I/O — it sends a request and returns the
 * response; it NEVER reads or writes the filesystem. Uploads pass bytes obtained
 * via `fs.readBytes` (fs:read); downloads write the response via `fs.*`/`sys.*`.
 *
 * The tier flags are derived from the module's AUTHORITATIVE manifest (held
 * host-side, the worker can't forge them) and tell Rust what the URL may target:
 * `network:public` → HTTPS to public domains, `network:local` → IPs/localhost.
 * Rust does the URL classification + enforcement; here we only relay the grant.
 */
async function netRequest(opts: NetRequestOptions, permissions: readonly ModulePermission[]): Promise<NetResponse> {
  let bodyBase64: string | undefined;
  if (opts.body !== undefined && opts.body !== null) {
    const bytes = typeof opts.body === "string" ? new TextEncoder().encode(opts.body) : opts.body;
    bodyBase64 = bytesToBase64(bytes);
  }
  const res = await invoke<{ status: number; headers: Record<string, string>; bodyBase64: string }>(
    "http_request",
    {
      req: {
        url: opts.url,
        method: opts.method,
        headers: opts.headers,
        bodyBase64,
        allowPublic: permissions.includes("network:public"),
        allowLocal: permissions.includes("network:local"),
      },
    }
  );
  const bytes = base64ToBytes(res.bodyBase64);
  return { status: res.status, headers: res.headers, body: new TextDecoder().decode(bytes), bytes };
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
      pickFile:{ permission: "dialog", run: ([opts]) => AppBridge.dialog.pickFile(opts as Parameters<typeof AppBridge.dialog.pickFile>[0]) },
    },
    net: {
      // One role per command: a network request sends/receives bytes, it never
      // touches the filesystem. Uploads pass bytes from fs.readBytes (fs:read);
      // downloads save the response via fs.*/sys.writeTempFile. Needs either
      // network tier; which one the module holds bounds the URLs Rust will allow.
      request: { permission: ["network:public", "network:local"], run: ([opts], _id, perms) => netRequest(opts as NetRequestOptions, perms) },
    },
    // Discovery-source tooling: validate an ESM source in a throwaway worker and
    // read its manifest. A discovery module uses this to turn a fetched index.js
    // into listing metadata; the worker spin-up stays in the host.
    modules: {
      probe: { permission: "discovery", run: ([source]) => probeManifest(source as string) },
      // Hand a module source to the install flow. It opens the Modules overlay and
      // shows the permission-review dialog (user consent) before anything is written
      // — a module proposes, the user approves. Used by the Local Installer module.
      install: { permission: "discovery", run: ([source]) => { ModulesStore.requestInstall(source as string); return Promise.resolve(null); } },
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
    // The app's home directory (a store, not the OS home): `core.home` resolves it
    // at launch, any module may override it. Read with sys.homeDir for the OS value.
    home: {
      get: { permission: "fs:read", run: async () => HomeStore.homeDir },
      set: { permission: "view",    run: async ([p]) => { HomeStore.setHomeDir(p as string); return null; } },
    },
    // Toggle the settings overlay (driven by the core.settings command on ⌘,).
    settings: {
      toggle: { permission: "view", run: async () => { SettingsStore.toggle(); return null; } },
    },
    // Declarative UI: render a serializable UINode tree into a named surface (a
    // panel, settings section, status-bar popover) or the app-wide modal. The
    // host renders it natively — no module code draws pixels. See protocol.ts.
    ui: {
      render: { permission: "ui", run: async ([surfaceId, node], moduleId) => { UIStore.render(moduleId, surfaceId as string, node as UINode); return null; } },
      clear:  { permission: "ui", run: async ([surfaceId], moduleId) => { UIStore.clear(moduleId, surfaceId as string); return null; } },
      modal:  { permission: "ui", run: async ([node], moduleId) => { UIStore.setModal(moduleId, (node as UINode | null) ?? null); return null; } },
    },
    // Bottom status-bar items (e.g. a git branch widget). Upsert/remove by id;
    // clicking runs a command or opens a popover (a `ui` surface).
    statusbar: {
      set:    { permission: "ui", run: async ([item], moduleId) => { StatusBarStore.set(moduleId, item as StatusBarItem); return null; } },
      remove: { permission: "ui", run: async ([itemId], moduleId) => { StatusBarStore.remove(moduleId, itemId as string); return null; } },
    },
    sys: {
      homeDir:     { permission: "fs:read", run: () => invoke("get_home_dir") },
      // Last visited local directory, restored at launch. Null on first run.
      lastDir:     { permission: "fs:read", run: async () => localStorage.getItem(LAST_DIR_KEY) },
      // Write bytes to a temp file, returning its path. Accepts a Uint8Array (e.g.
      // a downloaded response body) or a base64 string (a Finder-dropped file).
      // Lower-risk than fs:write (OS temp dir only), so it has its own `fs:temp`
      // permission. Rust confines the write to the temp dir by name (no traversal).
      writeTempFile: { permission: "fs:temp", run: ([filename, data]) => {
        const contentBase64 = data instanceof Uint8Array ? bytesToBase64(data) : String(data);
        return invoke("write_temp_file", { filename, contentBase64 });
      } },
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
