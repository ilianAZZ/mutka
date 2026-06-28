import type { ComponentType } from "react";
import type { FileItem, BaseContext } from "../types";
import type { MenuZone } from "../menu/menuZone";

// =============================================================================
// INTERNAL REGISTRY CONTRACT
//
// These are the shapes ModuleRegistry stores. Module AUTHORS do not write these
// directly — they write `defineModule({...})` (see core/sandbox/defineModule.ts),
// and a runtime (LocalHost / SandboxHost) turns the module into the MutkaModule
// below via proxyModule.ts. Keep this file about what the registry + UI consume.
// =============================================================================

// ─── Permissions ──────────────────────────────────────────────────────────────

/**
 * Permissions a module may request. A module must declare every capability it
 * uses; the gateway (core/sandbox/gateway.ts) denies any capability whose
 * permission is absent from the module's manifest.
 */
export type ModulePermission =
  | "fs:read"        // reads directory contents or file metadata
  | "fs:write"       // creates, modifies, moves, or deletes files/directories
  | "fs:temp"        // writes a short-lived file to the OS temp dir (lower-risk than fs:write)
  | "clipboard:read" // reads clipboard contents
  | "clipboard:write"// writes to the native clipboard
  | "navigation"     // changes the active directory / drives tabs
  | "view"           // controls view state: selection, sort, filters
  | "dialog"         // shows prompts or confirmation dialogs to the user
  | "network:public" // outbound HTTPS to public domains only (no IPs/localhost)
  | "network:local"  // outbound http/https to IP addresses or localhost only
  | "storage"        // reads/writes its own persisted config (per-module namespace)
  | "secrets"        // reads/writes its own credentials in the macOS Keychain
  | "ui"             // renders declarative panels/popups/settings + status-bar items
  | "discovery"      // contributes a module-discovery source (+ probes module sources)
  | "shell";         // executes shell or system commands

// ─── Context menu categories ──────────────────────────────────────────────────

/**
 * Well-known context menu category labels. Use these for consistent grouping
 * across modules. Any custom string also works. Actions without a category appear
 * in an unlabeled default group shown first.
 */
export const ContextMenuCategories = {
  File:      "File",
  Edit:      "Edit",
  Selection: "Selection",
  View:      "View",
  Share:     "Share",
} as const;

export type BuiltinContextMenuCategory =
  (typeof ContextMenuCategories)[keyof typeof ContextMenuCategories];

/** A group of context menu actions rendered under a shared category header. */
export interface ContextMenuGroup {
  /** Category label shown as a small header. Undefined for the default (no-header) group. */
  label?: string;
  actions: MutkaAction[];
}

// ─── Sidebar items (declarative left-menu entries) ────────────────────────────

/**
 * Suggested categories for sidebar items. A module may use any custom string;
 * items sharing a category are grouped together under that header.
 */
export const SidebarCategories = {
  Favorites: "Favorites",
  Locations: "Locations",
  Cloud:     "Cloud",
  Devices:   "Devices",
  Tags:      "Tags",
} as const;

/**
 * A declarative entry a module contributes to the left "Places" sidebar.
 * Serializable — crosses the worker boundary. Clicking navigates to `path`
 * or runs `command` (provide one).
 */
export interface SidebarItem {
  id: string;
  label: string;
  /** Icon registry key (e.g. "cloud", "folder") or an emoji. */
  icon?: string;
  /** Group header. Use SidebarCategories or any custom string. */
  category?: string;
  /** Navigate here when clicked. */
  path?: string;
  /** Or run this command id when clicked. */
  command?: string;
  /**
   * Show a remove (✕) affordance. Clicking it emits "sidebar:item-remove" with
   * this item's id — the owning module listens and updates its dynamic items.
   */
  removable?: boolean;
}

/** A group of sidebar items rendered under a shared category header. */
export interface SidebarItemGroup {
  label?: string;
  items: SidebarItem[];
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export interface MutkaAction {
  /** Globally unique ID, format: "module-id.action-name", e.g. "core.clipboard.copy" */
  id: string;
  /** Human-readable label shown in menus and tooltips */
  label: string;
  /**
   * Optional icon key from the icon registry (e.g. "trash", "copy", "cloud").
   * Unknown keys render as nothing. Only string keys reach the renderer.
   * Full registry: src/components/ContextMenu/icon-registry.ts
   */
  icon?: string;
  /**
   * Keyboard shortcut in normalized form. Keys: meta, ctrl, alt, shift + key
   * name (lowercase). Examples: "meta+c", "meta+shift+n", "f2", "meta+backspace"
   */
  shortcut?: string;
  /** Show this action in the right-click context menu. Default: true. */
  showInContextMenu?: boolean;
  /**
   * Context menu category. Actions in the same category share a section header.
   * Use ContextMenuCategories or any custom string.
   */
  contextMenuCategory?: string;
  /**
   * UI regions this action appears in when right-clicked. Undefined → the default
   * zones (file rows + empty background). The registry filters context-menu
   * actions by the zone the user clicked. See core/menu/menuZone.ts.
   */
  contextMenuZones?: readonly MenuZone[];
  /** The operation to perform. May be async. Acts via the module's `host` capabilities. */
  execute: () => void | Promise<void>;
  /**
   * Whether this action can run right now. Disabled actions are greyed out.
   * Default: always enabled.
   */
  isEnabled?: (context: BaseContext) => boolean;
  /**
   * Whether this action is shown at all. Hidden actions don't appear in the menu
   * and their shortcut is suppressed. Default: always visible. Built from a
   * module's serializable `when` clause for sandboxed modules.
   */
  isVisible?: (context: BaseContext) => boolean;
}

// ─── Open handlers ────────────────────────────────────────────────────────────

export interface MutkaOpenHandler {
  /** Globally unique ID, format: "module-id.handler-name" */
  id: string;
  /**
   * Priority for conflict resolution. Higher number wins.
   * Core defaults are at 0. Community overrides should use 1–100.
   */
  priority?: number;
  /** Return true if this handler wants to handle the given item. */
  matches: (item: FileItem) => boolean;
  /** Execute the open operation. Acts via the module's `host` capabilities. */
  handle: (item: FileItem) => void | Promise<void>;
}

// ─── Sidebar panels ────────────────────────────────────────────────────────────
// Extension surface rendered by components/Sidebar. The sandbox module format
// does not contribute these yet (custom UI in a worker is a separate problem —
// see TODO.md); core UI may register them directly.

export interface SidebarPanelProps {
  selectedItems: FileItem[];
  currentDirectory: string;
  navigate: (path: string) => void;
  refresh: () => void;
}

export interface MutkaSidebarPanel {
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

// ─── Declarative contributions (rendered from a serializable UINode tree) ──────
// A sandboxed module cannot ship a React component, so it contributes a panel /
// settings section as DATA and fills it via host.ui.render(surfaceId, node). The
// registry stores the bare contribution (with its owning moduleId); the React
// layer wraps each in the core <DeclarativeView>. See core/sandbox/protocol.ts
// for the author-facing PanelContribution / SettingsSectionContribution shapes.

export interface DeclarativePanelContribution {
  /** Owning module id (used to scope the UIStore surface + UI-event dispatch). */
  moduleId: string;
  /** Surface id within the module (== the contributed panel id). */
  id: string;
  title: string;
  icon: string;
  side?: "left" | "right";
  defaultWidth?: number;
}

export interface SettingsSectionContribution {
  moduleId: string;
  id: string;
  title: string;
}

/** A button a module adds to the Modules overlay (Browse tab). Click → the owning
 *  module's onUIEvent handler. Mirrors protocol.ModuleManagerButton + moduleId. */
export interface ModuleManagerButtonContribution {
  moduleId: string;
  id: string;
  label: string;
  icon?: string;
}

// ─── Module contract (built by proxyModule.ts from a defineModule) ────────────

export interface MutkaModule {
  /** Unique module ID. Follows the "author.name" convention. */
  id: string;
  /** Display name. */
  name: string;
  /** SemVer string, e.g. "1.0.0". */
  version: string;
  /** One-sentence description. */
  description?: string;
  /** Permissions this module declared — enforced by the capability gateway. */
  permissions?: readonly ModulePermission[];
  /** Actions this module contributes. */
  actions: MutkaAction[];
  /** Open handlers this module contributes (optional). */
  openHandlers?: MutkaOpenHandler[];
  /** Declarative left-sidebar entries this module contributes (optional). */
  sidebarItems?: SidebarItem[];
  /** Sidebar panels this module contributes as React components (core UI only). */
  sidebarPanels?: MutkaSidebarPanel[];
  /** Declarative side-pane panels filled from a UINode tree (sandbox-friendly). */
  declarativePanels?: DeclarativePanelContribution[];
  /** Declarative settings sections filled from a UINode tree (sandbox-friendly). */
  settingsSections?: SettingsSectionContribution[];
  /** Buttons this module adds to the Modules overlay (Browse tab). */
  moduleManagerButtons?: ModuleManagerButtonContribution[];
  /** Dispatch a UI-event (button/list/form interaction) into this module's runtime. */
  runUIEvent?: (handlerId: string, value: unknown) => void;
  /** Called once after registration. Return unsub fn(s) to run on unregister. */
  onMount?: () => (() => void) | (() => void)[] | void;
  /** Called once before unregistration, for non-EventBus cleanup (timers, etc.). */
  onUnmount?: () => void;
}
