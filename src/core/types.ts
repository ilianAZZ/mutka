// =============================================================================
// MACOWS EXPLORER — SHARED FOUNDATION TYPES
//
// Types used across multiple subsystems that don't belong to a single core file.
// Module-specific types live next to their owner:
//   MacowsModule, MacowsAction, etc. → core/module-registry/module-registry.types.ts
//   ThemePreference                  → core/theme-manager/theme-manager.types.ts
//   TabBarTab, TabsSnapshot          → core/tab-manager/tab-manager.types.ts
// =============================================================================

// ─── File system item ─────────────────────────────────────────────────────────

/** A single entry returned by the Rust `read_dir` command. */
export interface FileItem {
  /** Filename without path, e.g. "document.pdf" */
  name: string;
  /** Absolute POSIX path, e.g. "/Users/ilian/Documents/document.pdf" */
  path: string;
  /** True if this entry is a directory */
  isDir: boolean;
  /** File size in bytes. 0 for directories. */
  size: number;
  /** Last-modified timestamp in UNIX seconds */
  modified: number;
  /** Lowercase extension without dot, e.g. "pdf". Undefined for dirs or extensionless files. */
  extension?: string;
  /** True for dotfiles (name starts with "."). The UI dims these like Finder. */
  isHidden: boolean;
  /**
   * True if this entry is a symbolic link. `isDir`/`size`/`modified` reflect the
   * link's TARGET (Rust follows it), so a link to a folder navigates in-app.
   */
  isSymlink: boolean;
  /**
   * True if this directory is a macOS package/bundle (.app, .bundle, …). Though
   * `isDir` is true, the UI launches it like a file and shows its real icon
   * instead of navigating into it.
   */
  isPackage: boolean;
  /**
   * True if this folder carries a custom Finder icon (an "Icon\r" file). Still
   * navigable, but the UI shows its real icon instead of the generic folder one.
   */
  hasCustomIcon: boolean;
}

// ─── Clipboard ────────────────────────────────────────────────────────────────

export interface ClipboardState {
  /** Items currently held in the clipboard */
  items: FileItem[];
  /** Whether items were copied or cut. Null when clipboard is empty. */
  operation: "copy" | "cut" | null;
}

// ─── Navigation API ────────────────────────────────────────────────────────────

export interface NavigationAPI {
  /** Navigate to a directory, adding it to the history stack */
  navigate: (path: string) => void;
  /** Go back one step in history */
  goBack: () => void;
  /** Go forward one step in history */
  goForward: () => void;
  /** Navigate to the parent of the current directory */
  goUp: () => void;
  /** Whether there is a previous entry to go back to */
  canGoBack: boolean;
  /** Whether there is a next entry to go forward to */
  canGoForward: boolean;
}

// ─── Dialog API ────────────────────────────────────────────────────────────────

export interface DialogPromptOptions {
  /** Main question shown in the dialog */
  message: string;
  /** Placeholder text inside the input field */
  placeholder?: string;
  /** Pre-filled value in the input field */
  defaultValue?: string;
}

export interface DialogConfirmOptions {
  /** Main question shown in the dialog */
  message: string;
  /** Secondary descriptive text, shown smaller below the message */
  detail?: string;
  /** When true the confirm button is styled red. Use for destructive actions. */
  destructive?: boolean;
}

export interface DialogAPI {
  /** Show a text-input dialog. Resolves with the entered string or null if cancelled. */
  prompt(options: DialogPromptOptions): Promise<string | null>;
  /** Show a yes/no confirmation dialog. Resolves with true (confirm) or false (cancel). */
  confirm(options: DialogConfirmOptions): Promise<boolean>;
}

// ─── View context ────────────────────────────────────────────────────────────

/**
 * Read-only view of app state — used by isEnabled / isVisible (when) checks and
 * passed to the ContextMenu component for rendering. Modules never act through
 * this; all privileged operations go through the `host` capabilities (see
 * core/sandbox). This is purely for visibility/enablement predicates.
 */
export interface BaseContext {
  selectedItems: FileItem[];
  currentDirectory: string;
  clipboard: ClipboardState;
  navigation: NavigationAPI;
}
