import type { ComponentType } from "react";
import type { FileItem, ActionContext } from "../types";
import type { TabBarTab } from "../tab-manager/tab-manager.types";

// ─── Actions ──────────────────────────────────────────────────────────────────

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

// ─── Top bar panels ───────────────────────────────────────────────────────────

export interface TopBarPanelProps {
  /** Absolute path of the directory currently displayed */
  currentDirectory: string;
  /** Navigate to a directory */
  navigate: (path: string) => void;
  /** Open tabs — undefined when no tabs are open */
  tabs?: TabBarTab[];
  /** ID of the currently active tab, or null when no tabs are open */
  activeTabId?: number | null;
  /** Switch to an existing tab by ID */
  onTabSwitch?: (id: number) => void;
  /** Close a tab by ID */
  onTabClose?: (id: number) => void;
  /** Open a new tab at the current directory */
  onTabNew?: () => void;
}

export interface MacowsTopBarPanel {
  /** Globally unique ID, format: "module-id.panel-name" */
  id: string;
  /** Render order — lower numbers appear higher. Default: 0 */
  order?: number;
  /** React component rendered in the top bar */
  component: ComponentType<TopBarPanelProps>;
}

// ─── Module contract ──────────────────────────────────────────────────────────

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
  /** Top bar panels this module contributes (optional) */
  topBarPanels?: MacowsTopBarPanel[];
  /** Called once after the module is registered. Use for setup. */
  onMount?: () => void;
  /** Called once before the module is unregistered. Use for cleanup. */
  onUnmount?: () => void;
}

// ─── Module manager ───────────────────────────────────────────────────────────

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
