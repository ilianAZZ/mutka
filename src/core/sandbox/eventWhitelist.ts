import type { ModulePermission } from "../module-registry/module-registry.types";

// What a sandboxed module is allowed to learn from the bus via host.events.on().
//
// No event carries a credential — the only things that cross the bus are file
// paths/names, a few booleans/ids, and (for file:external-drop) file bytes. So
// the axis here is PRIVACY, not secrecy: paths reveal the user's directory
// structure, and aggregated streams reveal behaviour. We gate on that in two
// tiers:
//
//   • SUBSCRIBABLE_EVENTS — delivered WITH their payload. Either carry nothing
//     sensitive (booleans, theme, module ids) or carry the single path/items a
//     module legitimately needs to act on.
//   • NOTIFY_ONLY_EVENTS — delivered as a bare ping, payload replaced by
//     `undefined`. The OCCURRENCE is useful (cache-bust, re-render) but the
//     payload is profiling-grade (the whole clipboard, every open tab). A module
//     that wants the data fetches it through a permission-gated capability (e.g.
//     board.readFiles needs clipboard:read).
//
// Add entries deliberately — this is a trust surface. Host-internal events that
// would leak OTHER modules' state (ui:changed, statusbar:changed) or arbitrary
// internals (error:action) are on neither list and stay unreachable.
export const SUBSCRIBABLE_EVENTS = new Set<string>([
  // Lifecycle / launch
  "app:ready",
  // Input + open intents (the single item/path the module acts on)
  "input:mouse-navigate",
  "selection:changed",
  "file:modifier-open",
  "file:middle-open",
  "file:open-no-app",
  "file:external-drop",
  "sidebar:item-remove",
  "directory:changed",
  "navigation:start",
  "navigation:back",
  "navigation:forward",
  // Open-folder timing lifecycle events (consumed by core.telemetry).
  "listing:loaded",
  "listing:rendered",
  "icons:settled",
  // Trivial, non-path signals (booleans / ids / theme) — nothing to protect.
  "theme:changed",
  "view:changed",
  "settings:changed",
  "modules-ui:changed",
  "sidebar:changed",
  "module:registered",
  "module:unregistered",
  "columns:cell-resolved",
  "columns:widths-changed",
  // The id of the command that just ran (e.g. "core.clipboard.copy"). A static
  // FEATURE identifier, not user data (no paths/contents) — unlike clipboard/tabs
  // below, whose payloads carry the user's files. The occurrence + timing of this
  // event was already observable, so delivering the id only adds "which feature";
  // it lets a usage/analytics module report command popularity.
  "action:dispatch",
]);

// Delivered as a bare ping (payload stripped to `undefined`). See the note above.
export const NOTIFY_ONLY_EVENTS = new Set<string>([
  "clipboard:changed", // full clipboard contents → re-read via board.readFiles (clipboard:read)
  "tabs:changed",      // every open tab's path
]);

// A few whitelisted events carry data sensitive enough that RECEIVING them needs a
// permission — subscribing is otherwise unpermissioned. `file:external-drop` delivers
// the actual BYTES of files the user dragged in from Finder, so a module must hold
// `fs:read` to receive it (the same gate that reading those bytes any other way would
// require). Without the permission the subscription is dropped, like a non-whitelisted
// event. Keyed by event → the permission the subscriber must declare.
export const EVENT_REQUIRED_PERMISSION: Record<string, ModulePermission> = {
  "file:external-drop": "fs:read",
};

/** The permission a module must declare to RECEIVE this event, if any. */
export function requiredPermissionFor(event: string): ModulePermission | undefined {
  return EVENT_REQUIRED_PERMISSION[event];
}

/** Whether a module may subscribe to this event at all (either tier). */
export function isSubscribable(event: string): boolean {
  return SUBSCRIBABLE_EVENTS.has(event) || NOTIFY_ONLY_EVENTS.has(event);
}

/** Whether this event is delivered without its payload (occurrence only). */
export function isNotifyOnly(event: string): boolean {
  return NOTIFY_ONLY_EVENTS.has(event);
}

/**
 * The payload a module is allowed to receive for an event: the real payload for
 * a full-tier event, `undefined` for a notify-only one. Callers must already
 * have checked isSubscribable.
 */
export function deliverablePayload(event: string, payload: unknown): unknown {
  return NOTIFY_ONLY_EVENTS.has(event) ? undefined : payload;
}
