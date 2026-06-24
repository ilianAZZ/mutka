// =============================================================================
// MACOWS EXPLORER — CORE TYPE DEFINITIONS
//
// This file is the single source of truth for all public contracts.
// Every module, component, and Tauri command maps to types defined here.
//
// Strict rules:
//   - No `any`. Ever. Use `unknown` + type guards if the shape is unknown.
//   - No optional property unless it is genuinely optional at runtime.
//   - Keep types flat — no deeply nested generic abstractions.
//   - When adding a field, always add a JSDoc comment explaining it.
// =============================================================================

import type { ComponentType } from "react";

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
//
// Native-feeling modal dialogs driven by the app shell.
// Modules call ctx.dialog.prompt() / ctx.dialog.confirm() — the app shell
// renders the Liquid Glass modal and resolves the Promise when the user responds.

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

// ─── Action context ────────────────────────────────────────────────────────────
//
// Passed to every action.execute() and openHandler.handle() call.
// This is the module's window into the app state — it never imports React hooks directly.

export interface ActionContext {
  /** Files currently selected in the active view */
  selectedItems: FileItem[];
  /** Absolute path of the directory currently displayed */
  currentDirectory: string;
  /**
   * Current clipboard state — read-only snapshot.
   * To update, emit EventBus.emit("clipboard:changed", state) from your module.
   */
  clipboard: ClipboardState;
  /** Navigation API — back, forward, up, and direct navigation */
  navigation: NavigationAPI;
  /** Re-read the current directory and refresh the file list */
  refresh: () => void;
  /** Modal dialog API — use instead of native prompt() / confirm() */
  dialog: DialogAPI;
}

// ─── Actions ──────────────────────────────────────────────────────────────────
//
// An action is a named operation that can be triggered by keyboard shortcut,
// context menu, toolbar button, or programmatically.

export interface MacowsAction {
  /** Globally unique ID, format: "module-id.action-name", e.g. "clipboard.copy" */
  id: string;
  /** Human-readable label shown in menus and tooltips */
  label: string;
  /** Optional emoji or SF Symbol name for icon slots */
  icon?: string;
  /**
   * Keyboard shortcut in normalized form.
   * Keys: meta, ctrl, alt, shift + key name (lowercase).
   * Examples: "meta+c", "meta+shift+n", "f2", "meta+backspace"
   */
  shortcut?: string;
  /** Show this action in the right-click context menu. Default: true. */
  showInContextMenu?: boolean;
  /** Show this action as a button in the toolbar. Default: false. */
  showInToolbar?: boolean;
  /** Render a separator line above this item in the context menu. Default: false. */
  separator?: boolean;
  /** The operation to perform. May be async. */
  execute: (context: ActionContext) => void | Promise<void>;
  /**
   * Whether this action can be executed right now.
   * Disabled actions appear greyed out in menus.
   * Default: always enabled.
   */
  isEnabled?: (context: ActionContext) => boolean;
  /**
   * Whether this action should be shown at all.
   * Hidden actions do not appear in menus.
   * Default: always visible.
   */
  isVisible?: (context: ActionContext) => boolean;
}

// ─── Open handlers ────────────────────────────────────────────────────────────
//
// An open handler controls what happens when the user double-clicks a file or folder.
// The handler with the HIGHEST priority whose matches() returns true wins.
//
// Built-in defaults (priority 0):
//   - Folder → navigate in place          (core.navigation module)
//   - File   → open with macOS system app (core.navigation module)
//
// Community override examples:
//   - "tabs" module: priority 10, matches isDir → opens folder in a new tab
//   - "image viewer" module: priority 5, matches .png/.jpg → shows in-app preview
//   - "text editor" module: priority 5, matches .txt/.md → opens built-in editor

export interface MacowsOpenHandler {
  /** Globally unique ID, format: "module-id.handler-name" */
  id: string;
  /**
   * Priority for conflict resolution. Higher number wins.
   * Core defaults are at 0. Community overrides should use 1–100.
   */
  priority?: number;
  /** Return true if this handler wants to handle the given item */
  matches: (item: FileItem) => boolean;
  /** Execute the open operation */
  handle: (item: FileItem, context: ActionContext) => void | Promise<void>;
}

// ─── Sidebar panels ────────────────────────────────────────────────────────────
//
// A module can register one or more sidebar panels.
// Panels appear as tabs in a collapsible sidebar on the left or right side.
//
// The panel component receives SidebarPanelProps and can use the full
// React API, but must NOT import from the app shell directly — only from
// src/core/types.ts and its own module folder.

export interface SidebarPanelProps {
  selectedItems: FileItem[];
  currentDirectory: string;
  navigate: (path: string) => void;
  refresh: () => void;
}

export interface MacowsSidebarPanel {
  /** Globally unique ID, format: "module-id.panel-name" */
  id: string;
  /** Icon shown in the sidebar tab strip (emoji or SF Symbol name) */
  icon: string;
  /** Tooltip / accessible label for the panel tab */
  title: string;
  /** Which side the panel prefers. Core may override based on layout. */
  side?: "left" | "right";
  /** Default panel width in pixels. Min 180, max 480. */
  defaultWidth?: number;
  /** React component rendered inside the panel */
  component: ComponentType<SidebarPanelProps>;
}

// ─── Module contract ──────────────────────────────────────────────────────────
//
// A MacowsModule is the top-level export of every module package.
// It is the ONLY thing the ModuleRegistry cares about.
//
// Naming convention for module IDs:
//   Built-in  → "core.<name>"          e.g. "core.clipboard"
//   Community → "<author>.<name>"      e.g. "acme.git-status"
//
// A module must be side-effect-free at import time.
// All initialization goes in onMount(); all cleanup goes in onUnmount().

export interface MacowsModule {
  /** Unique module ID. Follows the "author.name" convention. */
  id: string;
  /** Display name shown in the Module Manager UI */
  name: string;
  /** SemVer string, e.g. "1.0.0" */
  version: string;
  /** One-sentence description shown in the Module Manager UI */
  description?: string;
  /** Actions this module contributes */
  actions: MacowsAction[];
  /** Open handlers this module contributes (optional) */
  openHandlers?: MacowsOpenHandler[];
  /** Sidebar panels this module contributes (optional) */
  sidebarPanels?: MacowsSidebarPanel[];
  /** Called once after the module is registered. Use for setup. */
  onMount?: () => void;
  /** Called once before the module is unregistered. Use for cleanup. */
  onUnmount?: () => void;
}

// ─── Module manager ───────────────────────────────────────────────────────────
//
// Describes a module entry in the built-in Module Manager UI.
// NOTE: The registry URL and remote manifest format are TBD.
// See: src/modules/module-manager/CLAUDE.md when that module is implemented.

export type ModuleInstallStatus = "installed" | "available" | "update-available" | "error";

export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  /** npm package name or git URL */
  source: string;
  status: ModuleInstallStatus;
}

// ─── Theme ────────────────────────────────────────────────────────────────────

/** Controls which color theme is applied. "system" follows prefers-color-scheme. */
export type ThemePreference = "system" | "light" | "dark";
