import type { SandboxCommand, SandboxOpenHandler, FileIconContribution, ColumnContribution, PanelContribution, SettingsSectionContribution, ModuleAuthor, DiscoverySourceDecl, ModuleManagerButton } from "./protocol";
import type { ModulePermission, SidebarItem } from "../module-registry/module-registry.types";
import type { SandboxHostApi } from "./hostProxy";

// Author-facing helper for writing a module. It only adds types — at runtime it
// returns its argument unchanged. A module is a plain ESM file that does
// `export default defineModule({ ... })`. It imports NOTHING from the core: it
// receives everything through the `host` given to setup(). Built-in and
// community modules use this identical shape.

export interface SandboxModuleDef {
  /** Unique module id, "author.name" convention. */
  id: string;
  name?: string;
  version?: string;
  description?: string;
  /**
   * Display image for the Modules UI: a `data:image/...` URI (self-contained) or
   * an `https://` URL. Rendered via <img src> only, so it is injection-safe.
   */
  icon?: string;
  /**
   * Who made this module — shown in the Modules UI as an avatar + profile link.
   * `author.github` (a user or org login) drives the avatar; when omitted and the
   * module is installed from a GitHub repo, it defaults to the repo owner.
   */
  author?: ModuleAuthor;
  /** Free-form tags for discovery filtering, e.g. ["files", "git", "viewer"]. */
  tags?: string[];
  /** Every privileged capability this module uses MUST be listed here. */
  permissions?: ModulePermission[];
  /** Commands surfaced into the app's menus / toolbar. */
  commands?: SandboxCommand[];
  /** Open handlers (double-click behavior) by item type. */
  openHandlers?: SandboxOpenHandler[];
  /** Declarative entries in the left "Places" sidebar, grouped by category. */
  sidebarItems?: SidebarItem[];
  /**
   * File-type icon overrides: ship your own logo (a base64 data:image/... URI)
   * for a set of extensions, replacing the native macOS icon. Rendered via
   * <img src> only, so it's injection-safe.
   */
  fileIcons?: FileIconContribution[];
  /**
   * Custom list-view columns. Each column declares declarative applicability
   * (which directories it shows in, which items get a value) and its value is
   * produced by a provider registered in setup via host.onColumn(id, handler).
   */
  columns?: ColumnContribution[];
  /**
   * Declarative side-pane panels. Each declares a tab (id/title/icon/side); fill
   * it from setup with host.ui.render(id, node) — a serializable UINode tree the
   * host renders natively. Buttons/lists/forms in the tree fire UI-event handlers
   * registered via host.onUIEvent(id, handler). Requires the `ui` permission.
   */
  panels?: PanelContribution[];
  /**
   * Declarative settings sections shown inside the app's Settings panel. Same
   * model as `panels`: declare {id, title}, fill via host.ui.render(id, node).
   * Requires the `ui` permission.
   */
  settingsSections?: SettingsSectionContribution[];
  /**
   * URI schemes this module provides a virtual file system for (e.g. "nextcloud").
   * Register the handlers in setup with host.onList(scheme, …) / host.onOpenFile(…).
   * Works in BOTH runtimes: built-ins call providers in-process; community modules
   * serve each op over a worker round-trip. Note the worker realm has no DOM APIs
   * (DOMParser, etc.), so providers needing those should ship as built-ins.
   */
  fileSystemProviders?: string[];
  /**
   * Module-discovery sources this module provides (e.g. a GitLab or local-folder
   * source). Declare `{ id, label }` here, then in setup serve them with
   * host.onDiscover(id, …) and host.onFetchSource(id, …). The id appears in the
   * Modules "Browse" tab; results are validated + installed by the core. Gated by
   * the `discovery` permission (plus whatever the fetch needs, e.g. `network:public`).
   */
  discoverySources?: DiscoverySourceDecl[];
  /**
   * Buttons to add to the Modules overlay (Browse tab). Declare `{ id, label, icon? }`
   * and register the click handler with `host.onUIEvent(id, …)`. Lets a module
   * surface an action there (e.g. an "Import local file" installer button).
   */
  moduleManagerButtons?: ModuleManagerButton[];
  /**
   * Runs once after load. Register command/open handlers and event subscriptions
   * here. Reaches the system only through `host.*` (each gated by permissions).
   */
  setup?: (host: SandboxHostApi) => void | Promise<void>;
}

export function defineModule(def: SandboxModuleDef): SandboxModuleDef {
  return def;
}

export type { SandboxHostApi } from "./hostProxy";
