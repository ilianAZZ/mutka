import type { ClipboardState, FileItem } from "../types";
import type { ThemePreference } from "../theme-manager/theme-manager.types";
import type { TabsSnapshot } from "../tab-manager/tab-manager.types";

/**
 * Maps every known EventBus key to the type of its payload.
 * Use declaration merging to add custom events in community modules:
 *
 *   declare module "../../core/event-bus/events" {
 *     interface EventMap { "my-module:did-something": { path: string } }
 *   }
 */
export interface EventMap {
  "theme:changed": { preference: ThemePreference; resolved: "dark" | "light" };
  "clipboard:changed": ClipboardState;
  "navigation:back": undefined;
  "navigation:forward": undefined;
  "file:modifier-open": { item: FileItem; modifiers: { ctrl: boolean; meta: boolean } };
  "module:registered": { moduleId: string };
  "module:unregistered": { moduleId: string };
  "error:action": { actionId: string; error: unknown };
  "input:mouse-navigate": { direction: "back" | "forward" };
  "tabs:changed": TabsSnapshot;
  "tabs:last-closed": { path: string };
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
  Tabs: {
    changed: "tabs:changed",
    lastClosed: "tabs:last-closed",
  },
} as const satisfies { [ns: string]: { [name: string]: keyof EventMap } };
