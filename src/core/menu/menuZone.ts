// =============================================================================
// MENU ZONES — the "where" of a right-click.
//
// A context menu is contextual: the actions it shows depend on the region the
// user clicked (a file row, the empty file-list background, the breadcrumb, a
// sidebar panel). This file owns that vocabulary and the single resolver that
// maps a DOM event target to a zone.
//
// Components mark their region with `data-menu-zone="<zone>"`; the resolver
// walks up from the event target with closest(). Editable elements (inputs,
// textareas, contenteditable) are detected directly and reported as "editable"
// so the app yields to the native menu instead of showing its own — that is
// what makes copy/paste work inside form fields.
// =============================================================================

/** The regions a right-click can land in. Serializable — part of the module contract. */
export const MENU_ZONES = ["file", "background", "breadcrumb", "sidebar"] as const;

export type MenuZone = (typeof MENU_ZONES)[number];

/**
 * Zones an action appears in when it declares none. The file explorer's natural
 * default: actions target the file view (rows + empty area), not chrome like the
 * breadcrumb or sidebar. A module opts into other zones via `contextMenuZones`.
 */
export const DEFAULT_MENU_ZONES: readonly MenuZone[] = ["file", "background"];

function isMenuZone(value: string | undefined): value is MenuZone {
  return value !== undefined && (MENU_ZONES as readonly string[]).includes(value);
}

/** True when the target is a text-editable element (input/textarea/select/contenteditable). */
export function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

/**
 * Resolve the menu zone for a right-click. Returns:
 *   "editable" → the click is inside a form field; show the native menu instead.
 *   a MenuZone → the nearest ancestor carrying data-menu-zone.
 *   null       → no zone found (caller may fall back to "background").
 */
export function resolveMenuZone(target: EventTarget | null): MenuZone | "editable" | null {
  if (isEditableElement(target)) return "editable";
  const el = target instanceof Element ? target : null;
  const zoned = el?.closest<HTMLElement>("[data-menu-zone]");
  return isMenuZone(zoned?.dataset.menuZone) ? zoned.dataset.menuZone : null;
}
