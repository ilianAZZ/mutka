import type { WorkerToHost, HostSnapshot, ColumnCell } from "./protocol";
import type { FileItem } from "../types";
import type { SidebarItem } from "../module-registry/module-registry.types";

// The `host` object handed to a module's setup(). Every method is a thin stub
// that asks the host to run a capability and awaits the reply. The module has no
// other reference to anything privileged. This is transport-agnostic: the hooks
// below are postMessage RPC for a worker module, or direct calls for a local
// (built-in) module — the module code is identical either way.

export type CommandHandler = (snapshot: HostSnapshot) => void | Promise<void>;
export type OpenHandler = (item: FileItem) => void | Promise<void>;
export type ColumnProvider = (item: FileItem) => ColumnCell | null | Promise<ColumnCell | null>;
export type EventHandler = (payload: unknown) => void;
export type ListHandler = (path: string) => FileItem[] | Promise<FileItem[]>;
export type OpenFileHandler = (path: string) => void | Promise<void>;
export type WriteHandler = (path: string) => void | Promise<void>;
export type RenameProviderHandler = (from: string, to: string) => void | Promise<void>;
export type TransferHandler = (paths: string[], dest: string) => void | Promise<void>;
export type ProviderMethod =
  | "list" | "openFile" | "createFolder" | "createFile" | "deleteItem" | "renameItem" | "copyFiles" | "moveFiles";
export type ProviderHandler = ListHandler | OpenFileHandler | WriteHandler | RenameProviderHandler | TransferHandler;

/** Options for host.net.request — a host-proxied HTTP call (bypasses CORS). */
export interface NetRequestOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

/** Options for host.net.download — saves a URL to a temp file, returns its path. */
export interface NetDownloadOptions {
  url: string;
  filename: string;
  headers?: Record<string, string>;
}

/** Options for host.net.upload — PUTs a local file's bytes to a URL. */
export interface NetUploadOptions {
  localPath: string;
  url: string;
  headers?: Record<string, string>;
}

export interface SandboxHostApi {
  fs: {
    readDir(path: string): Promise<unknown>;
    openItem(path: string): Promise<unknown>;
    /** Read a file's raw bytes (resolves to a Uint8Array). */
    readBytes(path: string): Promise<unknown>;
    /** Whether a file is materialized locally or cloud-only ("downloaded" | "cloud"). */
    cloudStatus(path: string): Promise<unknown>;
    copyFiles(paths: string[], dest: string): Promise<unknown>;
    moveFiles(paths: string[], dest: string): Promise<unknown>;
    deleteItem(path: string): Promise<unknown>;
    renameItem(from: string, to: string): Promise<unknown>;
    createFile(path: string): Promise<unknown>;
    createFolder(path: string): Promise<unknown>;
  };
  board: {
    readFiles(): Promise<unknown>;
    writeFiles(paths: string[], operation: "copy" | "cut"): Promise<unknown>;
  };
  nav: {
    navigate(path: string): Promise<unknown>;
    goBack(): Promise<unknown>;
    goForward(): Promise<unknown>;
    goUp(): Promise<unknown>;
  };
  tabs: {
    openTab(path: string): Promise<unknown>;
    openTabInBackground(path: string): Promise<unknown>;
    isActive(): Promise<unknown>;
  };
  /** Drive view state: the current selection and the active sort. */
  selection: {
    set(items: FileItem[]): Promise<unknown>;
  };
  view: {
    setSort(sort: { key: string; dir: "asc" | "desc" }): Promise<unknown>;
    toggleSort(key: string): Promise<unknown>;
    /** Toggle whether hidden/system files (dotfiles) are shown. */
    toggleHidden(): Promise<unknown>;
    /** Explicitly set whether hidden/system files are shown. */
    setShowHidden(value: boolean): Promise<unknown>;
  };
  dialog: {
    prompt(options: { message: string; placeholder?: string; defaultValue?: string }): Promise<unknown>;
    confirm(options: { message: string; detail?: string; destructive?: boolean }): Promise<unknown>;
    /** Show a single-choice list. Resolves with the chosen option's value, or null. */
    choose(options: { message: string; options: { label: string; value: string; detail?: string; icon?: string }[] }): Promise<unknown>;
  };
  sys: {
    homeDir(): Promise<unknown>;
    quickLook(path: string): Promise<unknown>;
    /** Refresh an already-open Quick Look panel to preview `path` (else no-op). */
    previewUpdate(path: string): Promise<unknown>;
    /** Apps that can open a file (Launch Services), default flagged + first. */
    appsForFile(path: string): Promise<unknown>;
    /** Open a file with a specific application bundle path. */
    openWith(path: string, appPath: string): Promise<unknown>;
    /** Start a native OS file drag of `paths`, previewed by `icon` (data-URI/path). */
    startDrag(paths: string[], icon?: string): Promise<unknown>;
  };
  /** Host-proxied HTTP (avoids CORS, gated by the `network` permission). */
  net: {
    request(options: NetRequestOptions): Promise<unknown>;
    download(options: NetDownloadOptions): Promise<unknown>;
    upload(options: NetUploadOptions): Promise<unknown>;
  };
  /** Per-module persisted config (gated by the `storage` permission). */
  config: {
    get(key: string): Promise<unknown>;
    set(key: string, value: string): Promise<unknown>;
  };
  /** Per-module credentials in the macOS Keychain (gated by `secrets`). */
  secrets: {
    get(key: string): Promise<unknown>;
    set(key: string, value: string): Promise<unknown>;
    delete(key: string): Promise<unknown>;
  };
  /** Re-read the current directory after a mutation. */
  refresh(): Promise<unknown>;
  /** Run an item through the open-resolution pipeline (keyboard double-click). */
  activate(item: FileItem): Promise<unknown>;
  /** Register the function that runs when one of this module's commands fires. */
  onCommand(commandId: string, handler: CommandHandler): void;
  /** Register the function that runs when an item matches one of this module's open handlers. */
  onOpen(handlerId: string, handler: OpenHandler): void;
  /** Register the value provider for one of this module's custom columns. */
  onColumn(columnId: string, provider: ColumnProvider): void;
  /** Register the directory-listing handler for a file system provider scheme. */
  onList(scheme: string, handler: ListHandler): void;
  /** Register the file-open handler for a file system provider scheme. */
  onOpenFile(scheme: string, handler: OpenFileHandler): void;
  /** Register the create-folder handler for a file system provider scheme. */
  onCreateFolder(scheme: string, handler: WriteHandler): void;
  /** Register the create-file handler for a file system provider scheme. */
  onCreateFile(scheme: string, handler: WriteHandler): void;
  /** Register the delete handler for a file system provider scheme. */
  onDeleteItem(scheme: string, handler: WriteHandler): void;
  /** Register the rename/move handler for a file system provider scheme. */
  onRenameItem(scheme: string, handler: RenameProviderHandler): void;
  /** Register the copy handler (sources may be local → upload, or same-scheme). */
  onCopyFiles(scheme: string, handler: TransferHandler): void;
  /** Register the move handler (same-scheme sources). */
  onMoveFiles(scheme: string, handler: TransferHandler): void;
  /** Replace this module's dynamic left-sidebar items (e.g. a bookmarks list). */
  sidebar: { set(items: SidebarItem[]): void };
  /** Subscribe to a whitelisted app event. */
  events: { on(event: string, handler: EventHandler): void };
  /** Forwarded to the host console, prefixed with the module id. */
  log(...args: unknown[]): void;
}

interface Transport {
  callHost: (cap: string, method: string, args: unknown[]) => Promise<unknown>;
  registerCommand: (commandId: string, handler: CommandHandler) => void;
  registerOpen: (handlerId: string, handler: OpenHandler) => void;
  registerColumn: (columnId: string, provider: ColumnProvider) => void;
  registerProvider: (scheme: string, method: ProviderMethod, handler: ProviderHandler) => void;
  setSidebarItems: (items: SidebarItem[]) => void;
  subscribe: (event: string, handler: EventHandler) => void;
  post: (m: WorkerToHost) => void;
}

export function createHostProxy(t: Transport): SandboxHostApi {
  const { callHost } = t;
  return {
    fs: {
      readDir:      (path) => callHost("fs", "readDir", [path]),
      openItem:     (path) => callHost("fs", "openItem", [path]),
      readBytes:    (path) => callHost("fs", "readBytes", [path]),
      cloudStatus:  (path) => callHost("fs", "cloudStatus", [path]),
      copyFiles:    (paths, dest) => callHost("fs", "copyFiles", [paths, dest]),
      moveFiles:    (paths, dest) => callHost("fs", "moveFiles", [paths, dest]),
      deleteItem:   (path) => callHost("fs", "deleteItem", [path]),
      renameItem:   (from, to) => callHost("fs", "renameItem", [from, to]),
      createFile:   (path) => callHost("fs", "createFile", [path]),
      createFolder: (path) => callHost("fs", "createFolder", [path]),
    },
    board: {
      readFiles:  () => callHost("board", "readFiles", []),
      writeFiles: (paths, operation) => callHost("board", "writeFiles", [paths, operation]),
    },
    nav: {
      navigate:  (path) => callHost("nav", "navigate", [path]),
      goBack:    () => callHost("nav", "goBack", []),
      goForward: () => callHost("nav", "goForward", []),
      goUp:      () => callHost("nav", "goUp", []),
    },
    tabs: {
      openTab:             (path) => callHost("tabs", "openTab", [path]),
      openTabInBackground: (path) => callHost("tabs", "openTabInBackground", [path]),
      isActive:            () => callHost("tabs", "isActive", []),
    },
    selection: {
      set: (items) => callHost("selection", "set", [items]),
    },
    view: {
      setSort:       (sort) => callHost("view", "setSort", [sort]),
      toggleSort:    (key) => callHost("view", "toggleSort", [key]),
      toggleHidden:  () => callHost("view", "toggleHidden", []),
      setShowHidden: (value) => callHost("view", "setShowHidden", [value]),
    },
    dialog: {
      prompt:  (options) => callHost("dialog", "prompt", [options]),
      confirm: (options) => callHost("dialog", "confirm", [options]),
      choose:  (options) => callHost("dialog", "choose", [options]),
    },
    sys: {
      homeDir: () => callHost("sys", "homeDir", []),
      quickLook: (path) => callHost("sys", "quickLook", [path]),
      previewUpdate: (path) => callHost("sys", "previewUpdate", [path]),
      appsForFile: (path) => callHost("sys", "appsForFile", [path]),
      openWith: (path, appPath) => callHost("sys", "openWith", [path, appPath]),
      startDrag: (paths, icon) => callHost("sys", "startDrag", [paths, icon]),
    },
    net: {
      request: (options) => callHost("net", "request", [options]),
      download: (options) => callHost("net", "download", [options]),
      upload: (options) => callHost("net", "upload", [options]),
    },
    config: {
      get: (key) => callHost("config", "get", [key]),
      set: (key, value) => callHost("config", "set", [key, value]),
    },
    secrets: {
      get: (key) => callHost("secrets", "get", [key]),
      set: (key, value) => callHost("secrets", "set", [key, value]),
      delete: (key) => callHost("secrets", "delete", [key]),
    },
    refresh: () => callHost("app", "refresh", []),
    activate: (item) => callHost("app", "activate", [item]),
    onCommand: (commandId, handler) => t.registerCommand(commandId, handler),
    onOpen: (handlerId, handler) => t.registerOpen(handlerId, handler),
    onColumn: (columnId, provider) => t.registerColumn(columnId, provider),
    onList: (scheme, handler) => t.registerProvider(scheme, "list", handler),
    onOpenFile: (scheme, handler) => t.registerProvider(scheme, "openFile", handler),
    onCreateFolder: (scheme, handler) => t.registerProvider(scheme, "createFolder", handler),
    onCreateFile: (scheme, handler) => t.registerProvider(scheme, "createFile", handler),
    onDeleteItem: (scheme, handler) => t.registerProvider(scheme, "deleteItem", handler),
    onRenameItem: (scheme, handler) => t.registerProvider(scheme, "renameItem", handler),
    onCopyFiles: (scheme, handler) => t.registerProvider(scheme, "copyFiles", handler),
    onMoveFiles: (scheme, handler) => t.registerProvider(scheme, "moveFiles", handler),
    sidebar: { set: (items) => t.setSidebarItems(items) },
    events: { on: (event, handler) => t.subscribe(event, handler) },
    log: (...args) => t.post({ t: "log", level: "log", args }),
  };
}
