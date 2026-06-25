import type { ClipboardState, FileItem } from "../types";
import type { ThemePreference } from "../theme-manager/theme-manager.types";
import type { TabsSnapshot } from "../tab-manager/tab-manager.types";
import type { ListingSnapshot } from "../stores/listing.types";

/**
 * Maps every known EventBus key to the type of its payload.
 * Use declaration merging to add custom events in community modules:
 *
 *   declare module "../../core/event-bus/events" {
 *     interface EventMap { "my-module:did-something": { path: string } }
 *   }
 */
export interface EventMap {
  /** Emitted once after modules are loaded and AppBridge is connected. The launch hook. */
  "app:ready": undefined;
  "theme:changed": { preference: ThemePreference; resolved: "dark" | "light" };
  "clipboard:changed": ClipboardState;
  "navigation:back": undefined;
  "navigation:forward": undefined;
  "file:modifier-open": { item: FileItem; modifiers: { ctrl: boolean; meta: boolean } };
  "file:middle-open": { item: FileItem };
  /** A file was opened but no app claims it — the open-with module shows the picker. */
  "file:open-no-app": { path: string; name: string };
  "module:registered": { moduleId: string };
  "module:unregistered": { moduleId: string };
  "error:action": { actionId: string; error: unknown };
  "input:mouse-navigate": { direction: "back" | "forward" };
  "tabs:changed": TabsSnapshot;
  "tabs:last-closed": { path: string };
  /** A module's dynamic sidebar items changed — Places should re-read. */
  "sidebar:changed": undefined;
  /** User clicked the remove (✕) affordance on a sidebar item. */
  "sidebar:item-remove": { id: string };
  /** Settings → WebDAV changed the account list; the module re-reads. */
  "webdav:accounts-changed": undefined;
  /** Emitted by modules to invoke a registered action without touching the DOM. */
  "action:dispatch": { actionId: string };
  /** Emitted by SelectionStore whenever the selected items change. */
  "selection:changed": { items: FileItem[] };
  /** Emitted by ListingStore when the visible items or active sort change. */
  "listing:changed": ListingSnapshot;
  /** Emitted by ViewStore when a view preference (e.g. show-hidden) changes. */
  "view:changed": { showHidden: boolean };
  /** Coalesced signal that one or more custom-column cell values resolved. */
  "columns:cell-resolved": undefined;
  /** A column was resized — the list re-reads persisted widths. */
  "columns:widths-changed": undefined;
  /** Emitted by HomeStore when the app's home directory changes. */
  "home:changed": { homeDir: string };
  /** Emitted by SettingsStore when the settings overlay opens or closes. */
  "settings:changed": { open: boolean };
  /**
   * Files dropped from outside the app (e.g. Finder) onto a folder. The UI reads
   * the dropped File objects to base64; a module imports them via host capabilities.
   */
  "file:external-drop": { files: { name: string; base64: string }[]; dest: string };
}

/** Typed event name constants. Use `Events.Namespace.name` instead of bare strings. */
export const Events = {
  Theme: {
    changed: "theme:changed",
  },
  Clipboard: {
    changed: "clipboard:changed",
  },
  Navigation: {
    back: "navigation:back",
    forward: "navigation:forward",
  },
  File: {
    modifierOpen: "file:modifier-open",
    middleOpen: "file:middle-open",
    openNoApp: "file:open-no-app",
    externalDrop: "file:external-drop",
  },
  Module: {
    registered: "module:registered",
    unregistered: "module:unregistered",
  },
  Error: {
    action: "error:action",
  },
  Input: {
    mouseNavigate: "input:mouse-navigate",
  },
  Action: {
    dispatch: "action:dispatch",
  },
  Selection: {
    changed: "selection:changed",
  },
  Listing: {
    changed: "listing:changed",
  },
  View: {
    changed: "view:changed",
  },
  Columns: {
    cellResolved: "columns:cell-resolved",
    widthsChanged: "columns:widths-changed",
  },
  Tabs: {
    changed: "tabs:changed",
    lastClosed: "tabs:last-closed",
  },
  Sidebar: {
    changed: "sidebar:changed",
    itemRemove: "sidebar:item-remove",
  },
  Webdav: {
    accountsChanged: "webdav:accounts-changed",
  },
  Home: {
    changed: "home:changed",
  },
  Settings: {
    changed: "settings:changed",
  },
  App: {
    ready: "app:ready",
  },
} as const satisfies { [ns: string]: { [name: string]: keyof EventMap } };
