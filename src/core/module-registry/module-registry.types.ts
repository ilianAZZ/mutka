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
//
// The framework-free, author-facing subset (`ModulePermission`, `SidebarItem`,
// `SidebarCategories`, `SidebarItemGroup`) lives in `./public-types` so the
// author-facing SDK can re-export it without dragging in `react`; it's re-exported
// below so existing `from "./module-registry.types"` imports keep working.
// =============================================================================

export type { ModulePermission, SidebarItem, SidebarItemGroup } from "./public-types";
export { SidebarCategories } from "./public-types";
import type { ModulePermission, SidebarItem } from "./public-types";

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

// (Sidebar item types — SidebarCategories / SidebarItem / SidebarItemGroup —
//  moved to ./public-types and re-exported at the top of this file.)

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
