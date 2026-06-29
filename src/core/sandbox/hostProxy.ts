import type { WorkerToHost, HostSnapshot, ColumnCell, ProviderMethod, DiscoveryMethod, UINode, StatusBarItem, SandboxManifest, NetRequestOptions, NetResponse } from "./protocol";
import type { FileItem, AppInfo } from "../types";
import type { SidebarItem } from "../module-registry/public-types";
import type { DiscoveryQuery, DiscoveryResult } from "../discovery/types";
import type { SortKey, SortState } from "../stores/listing.types";
import type { CapabilityMethodMap } from "./capabilities";

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

export type { NetRequestOptions, NetResponse } from "./protocol";

/** What host.board.readFiles resolves to — the pasteboard's pending file list. */
export interface ClipboardFiles {
  paths: string[];
  operation: "copy" | "cut";
}

/** Whether a file's data is materialized locally or still cloud-only. */
export type CloudStatus = "downloaded" | "cloud";

export interface SandboxHostApi<TCommandId extends string = string> {
  fs: {
    /** List a directory's entries (works for local paths and provider schemes). */
    readDir(path: string): Promise<FileItem[]>;
    /** Open an item with the system default handler. */
    openItem(path: string): Promise<void>;
    /** Read a file's raw bytes. */
    readBytes(path: string): Promise<Uint8Array>;
    /** Whether a file is materialized locally or cloud-only. */
    cloudStatus(path: string): Promise<CloudStatus>;
    copyFiles(paths: string[], dest: string): Promise<void>;
    moveFiles(paths: string[], dest: string): Promise<void>;
    deleteItem(path: string): Promise<void>;
    renameItem(from: string, to: string): Promise<void>;
    createFile(path: string): Promise<void>;
    createFolder(path: string): Promise<void>;
  };
  board: {
    /** Read the pasteboard's pending file list, or null if it holds no files. */
    readFiles(): Promise<ClipboardFiles | null>;
    writeFiles(paths: string[], operation: "copy" | "cut"): Promise<void>;
  };
  nav: {
    navigate(path: string): Promise<void>;
    goBack(): Promise<void>;
    goForward(): Promise<void>;
    goUp(): Promise<void>;
  };
  tabs: {
    openTab(path: string): Promise<void>;
    openTabInBackground(path: string): Promise<void>;
    /** Whether this module's runtime is bound to the active tab. */
    isActive(): Promise<boolean>;
  };
  /** Drive view state: the current selection and the active sort. */
  selection: {
    set(items: FileItem[]): Promise<void>;
  };
  view: {
    setSort(sort: SortState): Promise<void>;
    toggleSort(key: SortKey): Promise<void>;
    /** Toggle whether hidden/system files (dotfiles) are shown. */
    toggleHidden(): Promise<void>;
    /** Explicitly set whether hidden/system files are shown. */
    setShowHidden(value: boolean): Promise<void>;
  };
  dialog: {
    /** Text-input dialog. Resolves with the entered string, or null if cancelled. */
    prompt(options: { message: string; placeholder?: string; defaultValue?: string }): Promise<string | null>;
    /** Yes/no dialog. Resolves true (confirm) or false (cancel). */
    confirm(options: { message: string; detail?: string; destructive?: boolean }): Promise<boolean>;
    /** Show a single-choice list. Resolves with the chosen option's value, or null. */
    choose(options: { message: string; options: { label: string; value: string; detail?: string; icon?: string }[] }): Promise<string | null>;
    /** Open a Mutka file browser to pick one file. Resolves with its path, or null. */
    pickFile(options?: { title?: string; initialDir?: string; fileNames?: string[] }): Promise<string | null>;
  };
  /** The app's home directory store (distinct from the OS home, sys.homeDir). */
  home: {
    /** Read the current app home directory. */
    get(): Promise<string>;
    /** Set the app home directory (any module may override it). */
    set(path: string): Promise<void>;
  };
  /** Toggle the settings overlay open/closed. */
  settings: {
    toggle(): Promise<void>;
  };
  /** Render declarative UI (a serializable UINode tree). Gated by `ui`. */
  ui: {
    /** Render/replace the UINode shown in a named surface (panel/settings/popover). */
    render(surfaceId: string, node: UINode): Promise<void>;
    /** Clear a surface so it renders empty. */
    clear(surfaceId: string): Promise<void>;
    /** Open a modal with `node`, or pass null to close the current one. */
    modal(node: UINode | null): Promise<void>;
  };
  /** Bottom status-bar items (e.g. a git widget). Gated by `ui`. */
  statusbar: {
    /** Add or replace one status-bar item (keyed by its id). */
    set(item: StatusBarItem): Promise<void>;
    /** Remove a status-bar item by id. */
    remove(itemId: string): Promise<void>;
  };
  sys: {
    /** The OS home directory. */
    homeDir(): Promise<string>;
    /** The app's own version string (e.g. "1.0.0"). Gated by `storage`. */
    appVersion(): Promise<string>;
    /** The last visited local directory, or null on first run. */
    lastDir(): Promise<string | null>;
    /** Write bytes to a temp file and return its path (Uint8Array, or a base64
     * string for a Finder-dropped file). Gated by `fs:temp`. */
    writeTempFile(filename: string, data: string | Uint8Array): Promise<string>;
    quickLook(path: string): Promise<void>;
    /** Refresh an already-open Quick Look panel to preview `path` (else no-op). */
    previewUpdate(path: string): Promise<void>;
    /** Apps that can open a file (Launch Services), default flagged + first. */
    appsForFile(path: string): Promise<AppInfo[]>;
    /** Open a file with a specific application bundle path. */
    openWith(path: string, appPath: string): Promise<void>;
    /** Start a native OS file drag of `paths`, previewed by `icon` (data-URI/path). */
    startDrag(paths: string[], icon?: string): Promise<void>;
  };
  /**
   * Host-proxied HTTP (avoids CORS, gated by `network:public` / `network:local`). One role:
   * it sends a request and returns the response — it never touches the filesystem.
   * To upload, read bytes via fs.readBytes (fs:read) and pass them as `body`; to
   * save a response, write `bytes` via fs.* / sys.writeTempFile.
   */
  net: {
    request(options: NetRequestOptions): Promise<NetResponse>;
  };
  /** Module tooling (gated by the `discovery` permission). */
  modules: {
    /** Validate an ESM source in a throwaway worker and return its manifest. */
    probe(source: string): Promise<SandboxManifest>;
    /** Propose a module source for install — opens the permission-review dialog so
     *  the user approves before anything is written. */
    install(source: string): Promise<void>;
  };
  /** Per-module persisted config (gated by the `storage` permission). */
  config: {
    /** Read a stored value, or null if the key was never set. */
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
  };
  /** Per-module credentials in the macOS Keychain (gated by `secrets`). */
  secrets: {
    /** Read a stored credential, or null if absent. */
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
  };
  /** Re-read the current directory after a mutation. */
  refresh(): Promise<void>;
  /** Run an item through the open-resolution pipeline (keyboard double-click). */
  activate(item: FileItem): Promise<void>;
  /** Register the function that runs when one of this module's commands fires.
   *  When you use `defineModule`, `commandId` is constrained to the ids you
   *  declared in `commands[]`, so a typo or stale id is a compile error. */
  onCommand(commandId: TCommandId, handler: CommandHandler): void;
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
  callHost: <G extends keyof CapabilityMethodMap>(cap: G, method: CapabilityMethodMap[G], args: unknown[]) => Promise<unknown>;
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
  // The wire result is always `unknown` (it crossed postMessage / the gateway).
  // `call` constrains cap/method to `CapabilityMethodMap`, so a typo or a
  // renamed capability is a compile error. The return cast to the expected shape
  // is at each call site (the gateway can't provide static return types).
  const call = <G extends keyof CapabilityMethodMap>(cap: G, method: CapabilityMethodMap[G], args: unknown[]): Promise<unknown> =>
    callHost(cap, method, args);
  return {
    fs: {
      readDir:      (path) => call("fs", "readDir", [path]) as Promise<FileItem[]>,
      openItem:     (path) => call("fs", "openItem", [path]) as Promise<void>,
      readBytes:    (path) => call("fs", "readBytes", [path]) as Promise<Uint8Array>,
      cloudStatus:  (path) => call("fs", "cloudStatus", [path]) as Promise<CloudStatus>,
      copyFiles:    (paths, dest) => call("fs", "copyFiles", [paths, dest]) as Promise<void>,
      moveFiles:    (paths, dest) => call("fs", "moveFiles", [paths, dest]) as Promise<void>,
      deleteItem:   (path) => call("fs", "deleteItem", [path]) as Promise<void>,
      renameItem:   (from, to) => call("fs", "renameItem", [from, to]) as Promise<void>,
      createFile:   (path) => call("fs", "createFile", [path]) as Promise<void>,
      createFolder: (path) => call("fs", "createFolder", [path]) as Promise<void>,
    },
    board: {
      readFiles:  () => call("board", "readFiles", []) as Promise<ClipboardFiles | null>,
      writeFiles: (paths, operation) => call("board", "writeFiles", [paths, operation]) as Promise<void>,
    },
    nav: {
      navigate:  (path) => call("nav", "navigate", [path]) as Promise<void>,
      goBack:    () => call("nav", "goBack", []) as Promise<void>,
      goForward: () => call("nav", "goForward", []) as Promise<void>,
      goUp:      () => call("nav", "goUp", []) as Promise<void>,
    },
    tabs: {
      openTab:             (path) => call("tabs", "openTab", [path]) as Promise<void>,
      openTabInBackground: (path) => call("tabs", "openTabInBackground", [path]) as Promise<void>,
      isActive:            () => call("tabs", "isActive", []) as Promise<boolean>,
    },
    selection: {
      set: (items) => call("selection", "set", [items]) as Promise<void>,
    },
    view: {
      setSort:       (sort) => call("view", "setSort", [sort]) as Promise<void>,
      toggleSort:    (key) => call("view", "toggleSort", [key]) as Promise<void>,
      toggleHidden:  () => call("view", "toggleHidden", []) as Promise<void>,
      setShowHidden: (value) => call("view", "setShowHidden", [value]) as Promise<void>,
    },
    dialog: {
      prompt:  (options) => call("dialog", "prompt", [options]) as Promise<string | null>,
      confirm: (options) => call("dialog", "confirm", [options]) as Promise<boolean>,
      choose:  (options) => call("dialog", "choose", [options]) as Promise<string | null>,
      pickFile: (options) => call("dialog", "pickFile", [options]) as Promise<string | null>,
    },
    home: {
      get: () => call("home", "get", []) as Promise<string>,
      set: (path) => call("home", "set", [path]) as Promise<void>,
    },
    settings: {
      toggle: () => call("settings", "toggle", []) as Promise<void>,
    },
    ui: {
      render: (surfaceId, node) => call("ui", "render", [surfaceId, node]) as Promise<void>,
      clear:  (surfaceId) => call("ui", "clear", [surfaceId]) as Promise<void>,
      modal:  (node) => call("ui", "modal", [node]) as Promise<void>,
    },
    statusbar: {
      set:    (item) => call("statusbar", "set", [item]) as Promise<void>,
      remove: (itemId) => call("statusbar", "remove", [itemId]) as Promise<void>,
    },
    sys: {
      homeDir: () => call("sys", "homeDir", []) as Promise<string>,
      appVersion: () => call("sys", "appVersion", []) as Promise<string>,
      lastDir: () => call("sys", "lastDir", []) as Promise<string | null>,
      writeTempFile: (filename, data) => call("sys", "writeTempFile", [filename, data]) as Promise<string>,
      quickLook: (path) => call("sys", "quickLook", [path]) as Promise<void>,
      previewUpdate: (path) => call("sys", "previewUpdate", [path]) as Promise<void>,
      appsForFile: (path) => call("sys", "appsForFile", [path]) as Promise<AppInfo[]>,
      openWith: (path, appPath) => call("sys", "openWith", [path, appPath]) as Promise<void>,
      startDrag: (paths, icon) => call("sys", "startDrag", [paths, icon]) as Promise<void>,
    },
    net: {
      request: (options) => call("net", "request", [options]) as Promise<NetResponse>,
    },
    modules: {
      probe: (source) => call("modules", "probe", [source]) as Promise<SandboxManifest>,
      install: (source) => call("modules", "install", [source]) as Promise<void>,
    },
    config: {
      get: (key) => call("config", "get", [key]) as Promise<string | null>,
      set: (key, value) => call("config", "set", [key, value]) as Promise<void>,
    },
    secrets: {
      get: (key) => call("secrets", "get", [key]) as Promise<string | null>,
      set: (key, value) => call("secrets", "set", [key, value]) as Promise<void>,
      delete: (key) => call("secrets", "delete", [key]) as Promise<void>,
    },
    refresh: () => call("app", "refresh", []) as Promise<void>,
    activate: (item) => call("app", "activate", [item]) as Promise<void>,
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
