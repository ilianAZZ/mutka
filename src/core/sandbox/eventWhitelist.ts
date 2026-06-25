// Events a module is allowed to subscribe to via host.events.on(). Kept narrow
// on purpose: a module should only receive notifications it has a legitimate
// reason to act on, and nothing carrying sensitive state. Add entries
// deliberately — this is a trust surface.
export const SUBSCRIBABLE_EVENTS = new Set<string>([
  "input:mouse-navigate",
  "file:modifier-open",
  "file:middle-open",
  "sidebar:item-remove",
  "webdav:accounts-changed",
]);

export function isSubscribable(event: string): boolean {
  return SUBSCRIBABLE_EVENTS.has(event);
}
