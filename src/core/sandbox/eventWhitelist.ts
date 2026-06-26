// Events a module is allowed to subscribe to via host.events.on(). Kept narrow
// on purpose: a module should only receive notifications it has a legitimate
// reason to act on, and nothing carrying sensitive state. Add entries
// deliberately — this is a trust surface.
export const SUBSCRIBABLE_EVENTS = new Set<string>([
  "app:ready",
  "input:mouse-navigate",
  "selection:changed",
  "file:modifier-open",
  "file:middle-open",
  "file:open-no-app",
  "file:external-drop",
  "sidebar:item-remove",
  "directory:changed",
  // Open-folder timing lifecycle events (consumed by core.telemetry).
  "navigation:start",
  "listing:loaded",
  "listing:rendered",
  "icons:settled",
]);

export function isSubscribable(event: string): boolean {
  return SUBSCRIBABLE_EVENTS.has(event);
}
