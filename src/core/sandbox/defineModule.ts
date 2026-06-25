import type { SandboxCommand, SandboxOpenHandler, FileIconContribution, ColumnContribution } from "./protocol";
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
   * URI schemes this module provides a virtual file system for (e.g. "nextcloud").
   * Register the handlers in setup with host.onList(scheme, …) / host.onOpenFile(…).
   * Supported for built-in (in-process) modules only — see TODO.md.
   */
  fileSystemProviders?: string[];
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
