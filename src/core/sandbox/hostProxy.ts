import type { WorkerToHost, HostSnapshot, ColumnCell, ProviderMethod, DiscoveryMethod, UINode, StatusBarItem } from "./protocol";
import type { FileItem } from "../types";
import type { SidebarItem } from "../module-registry/module-registry.types";
import type { DiscoveryQuery, DiscoveryResult } from "../discovery/types";

export type { ProviderMethod } from "./protocol";

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
export type ProviderHandler = ListHandler | OpenFileHandler | WriteHandler | RenameProviderHandler | TransferHandler;
/** A UI-event handler (button/list/form interaction) registered via host.onUIEvent. */
export type UIEventHandler = (value: unknown) => void | Promise<void>;
/** A discovery source's two handlers, registered via host.onDiscover / onFetchSource. */
export type DiscoverHandler = (query: DiscoveryQuery) => Promise<DiscoveryResult>;
export type FetchSourceHandler = (ref: string) => Promise<string>;

/** Options for host.net.request — a host-proxied HTTP call (bypasses CORS). */
export interface NetRequestOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  /** Text (UTF-8) or raw bytes (e.g. from host.fs.readBytes for an upload). */
  body?: string | Uint8Array;
}

/** What host.net.request resolves to. */
export interface NetResponse {
  status: number;
  headers: Record<string, string>;
  /** Body decoded as UTF-8 text (JSON/XML/text APIs). */
  body: string;
  /** Body as raw bytes (binary downloads). */
  bytes: Uint8Array;
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
    /** Open a Mutka file browser to pick one file. Resolves with its path, or null. */
    pickFile(options?: { title?: string; initialDir?: string; fileNames?: string[] }): Promise<unknown>;
  };
  /** The app's home directory store (distinct from the OS home, sys.homeDir). */
  home: {
    /** Read the current app home directory. */
    get(): Promise<unknown>;
    /** Set the app home directory (any module may override it). */
    set(path: string): Promise<unknown>;
  };
  /** Toggle the settings overlay open/closed. */
  settings: {
    toggle(): Promise<unknown>;
  };
  /** Render declarative UI (a serializable UINode tree). Gated by `ui`. */
  ui: {
    /** Render/replace the UINode shown in a named surface (panel/settings/popover). */
    render(surfaceId: string, node: UINode): Promise<unknown>;
    /** Clear a surface so it renders empty. */
    clear(surfaceId: string): Promise<unknown>;
    /** Open a modal with `node`, or pass null to close the current one. */
    modal(node: UINode | null): Promise<unknown>;
  };
  /** Bottom status-bar items (e.g. a git widget). Gated by `ui`. */
  statusbar: {
    /** Add or replace one status-bar item (keyed by its id). */
    set(item: StatusBarItem): Promise<unknown>;
    /** Remove a status-bar item by id. */
    remove(itemId: string): Promise<unknown>;
  };
  sys: {
    homeDir(): Promise<unknown>;
    /** The last visited local directory (for restoring navigation at launch). */
    lastDir(): Promise<unknown>;
    /** Write bytes to a temp file and return its path (Uint8Array, or a base64
     * string for a Finder-dropped file). Gated by `fs:temp`. */
    writeTempFile(filename: string, data: string | Uint8Array): Promise<unknown>;
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
  /**
   * Host-proxied HTTP (avoids CORS, gated by `network:public` / `network:local`). One role:
   * it sends a request and returns the response — it never touches the filesystem.
   * To upload, read bytes via fs.readBytes (fs:read) and pass them as `body`; to
   * save a response, write `bytes` via fs.* / sys.writeTempFile.
   */
  net: {
    request(options: NetRequestOptions): Promise<unknown>;
  };
  /** Module tooling (gated by the `discovery` permission). */
  modules: {
    /** Validate an ESM source in a throwaway worker and return its manifest. */
    probe(source: string): Promise<unknown>;
    /** Propose a module source for install — opens the permission-review dialog so
     *  the user approves before anything is written. */
    install(source: string): Promise<unknown>;
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
  /** Register a handler fired when a button/list/form in this module's UI is used. */
  onUIEvent(handlerId: string, handler: UIEventHandler): void;
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
  /** Register the discover handler for a declared discovery source. */
  onDiscover(sourceId: string, handler: DiscoverHandler): void;
  /** Register the fetch-source handler for a declared discovery source. */
  onFetchSource(sourceId: string, handler: FetchSourceHandler): void;
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
  registerUIEvent: (handlerId: string, handler: UIEventHandler) => void;
  registerProvider: (scheme: string, method: ProviderMethod, handler: ProviderHandler) => void;
  registerDiscovery: (sourceId: string, method: DiscoveryMethod, handler: DiscoverHandler | FetchSourceHandler) => void;
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
      pickFile: (options) => callHost("dialog", "pickFile", [options]),
    },
    home: {
      get: () => callHost("home", "get", []),
      set: (path) => callHost("home", "set", [path]),
    },
    settings: {
      toggle: () => callHost("settings", "toggle", []),
    },
    ui: {
      render: (surfaceId, node) => callHost("ui", "render", [surfaceId, node]),
      clear:  (surfaceId) => callHost("ui", "clear", [surfaceId]),
      modal:  (node) => callHost("ui", "modal", [node]),
    },
    statusbar: {
      set:    (item) => callHost("statusbar", "set", [item]),
      remove: (itemId) => callHost("statusbar", "remove", [itemId]),
    },
    sys: {
      homeDir: () => callHost("sys", "homeDir", []),
      lastDir: () => callHost("sys", "lastDir", []),
      writeTempFile: (filename, data) => callHost("sys", "writeTempFile", [filename, data]),
      quickLook: (path) => callHost("sys", "quickLook", [path]),
      previewUpdate: (path) => callHost("sys", "previewUpdate", [path]),
      appsForFile: (path) => callHost("sys", "appsForFile", [path]),
      openWith: (path, appPath) => callHost("sys", "openWith", [path, appPath]),
      startDrag: (paths, icon) => callHost("sys", "startDrag", [paths, icon]),
    },
    net: {
      request: (options) => callHost("net", "request", [options]),
    },
    modules: {
      probe: (source) => callHost("modules", "probe", [source]),
      install: (source) => callHost("modules", "install", [source]),
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
    onUIEvent: (handlerId, handler) => t.registerUIEvent(handlerId, handler),
    onList: (scheme, handler) => t.registerProvider(scheme, "list", handler),
    onOpenFile: (scheme, handler) => t.registerProvider(scheme, "openFile", handler),
    onCreateFolder: (scheme, handler) => t.registerProvider(scheme, "createFolder", handler),
    onCreateFile: (scheme, handler) => t.registerProvider(scheme, "createFile", handler),
    onDeleteItem: (scheme, handler) => t.registerProvider(scheme, "deleteItem", handler),
    onRenameItem: (scheme, handler) => t.registerProvider(scheme, "renameItem", handler),
    onCopyFiles: (scheme, handler) => t.registerProvider(scheme, "copyFiles", handler),
    onMoveFiles: (scheme, handler) => t.registerProvider(scheme, "moveFiles", handler),
    onDiscover: (sourceId, handler) => t.registerDiscovery(sourceId, "discover", handler),
    onFetchSource: (sourceId, handler) => t.registerDiscovery(sourceId, "fetchSource", handler),
    sidebar: { set: (items) => t.setSidebarItems(items) },
    events: { on: (event, handler) => t.subscribe(event, handler) },
    log: (...args) => t.post({ t: "log", level: "log", args }),
  };
}
