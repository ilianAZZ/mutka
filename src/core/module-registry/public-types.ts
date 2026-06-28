// =============================================================================
// PUBLIC, FRAMEWORK-FREE REGISTRY TYPES
//
// The subset of the registry contract that module AUTHORS also use — module
// permissions and the declarative sidebar-item shapes. These are serializable
// and carry NO React (or any app-internal) dependency, deliberately kept apart
// from `module-registry.types.ts` (which imports `react` for the core-only
// `MutkaSidebarPanel`/`SidebarPanelProps`).
//
// Why the split: the author-facing types package `@mutka-explorer/module` is
// generated from these source files, and the dts bundler type-checks every file
// it transitively loads. Co-locating these with the React-coupled types would
// drag `react` into the SDK build for no reason. `module-registry.types.ts`
// re-exports everything here, so existing in-app imports are unaffected.
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
