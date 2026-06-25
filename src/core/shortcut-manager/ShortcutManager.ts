import { EventBus } from "../event-bus/EventBus";
import { Events } from "../event-bus/events";
import { isEditableElement } from "../menu/menuZone";

const STORAGE_KEY = "macows.keybinds";

export interface KeyBinding {
  actionId: string;
  /** Effective shortcut (override if set, else the module default). */
  shortcut: string | undefined;
  /** The module's built-in shortcut. */
  defaultShortcut: string | undefined;
  /** True when the user has overridden the default. */
  isCustom: boolean;
}

/**
 * Owns keyboard → action dispatch. Module defaults are registered via bind();
 * the user can override them (persisted to localStorage) and import/export the
 * override set. Effective binding = user override ?? module default.
 */
class ShortcutManagerClass {
  private defaults = new Map<string, string>();  // actionId → normalized default
  private overrides = new Map<string, string>(); // actionId → normalized override
  private active = new Map<string, string>();    // normalized key → actionId

  constructor() {
    this.loadOverrides();
    document.addEventListener("keydown", (e) => {
      // Never hijack keys while the user is typing in a field — let the WebView's
      // native copy/cut/paste/select-all run (e.g. the Nextcloud login form).
      if (isEditableElement(e.target)) return;
      const actionId = this.active.get(this.normalize(e));
      if (actionId) {
        e.preventDefault();
        EventBus.emit(Events.Action.dispatch, { actionId });
      }
    });
  }

  /** Register a module's default shortcut for an action. */
  bind(actionId: string, shortcut: string): void {
    this.defaults.set(actionId, shortcut.toLowerCase());
    this.rebuild();
  }

  /** Remove an action's default (on module unregister). */
  unbind(actionId: string): void {
    this.defaults.delete(actionId);
    this.rebuild();
  }

  /** The effective shortcut for an action (override first, else default). */
  shortcutFor(actionId: string): string | undefined {
    return this.overrides.get(actionId) ?? this.defaults.get(actionId);
  }

  /** Set or clear a user override. Pass null/empty to revert to the default. */
  setOverride(actionId: string, shortcut: string | null): void {
    if (!shortcut) this.overrides.delete(actionId);
    else this.overrides.set(actionId, shortcut.toLowerCase());
    this.persist();
    this.rebuild();
  }

  resetOverrides(): void {
    this.overrides.clear();
    this.persist();
    this.rebuild();
  }

  /** Every action that has a binding, with its effective + default shortcut. */
  listBindings(): KeyBinding[] {
    return Array.from(this.defaults.keys()).map((actionId) => ({
      actionId,
      shortcut: this.shortcutFor(actionId),
      defaultShortcut: this.defaults.get(actionId),
      isCustom: this.overrides.has(actionId),
    }));
  }

  /** Serialize the user overrides (for export). */
  exportOverrides(): string {
    return JSON.stringify(Object.fromEntries(this.overrides), null, 2);
  }

  /** Replace overrides from a previously exported JSON string. */
  importOverrides(json: string): void {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) throw new Error("invalid keybinds file");
    this.overrides = new Map(
      Object.entries(parsed as Record<string, string>)
        .filter(([, v]) => typeof v === "string")
        .map(([k, v]) => [k, v.toLowerCase()])
    );
    this.persist();
    this.rebuild();
  }

  /** Normalize a keyboard event into a shortcut string, e.g. "meta+shift+n". */
  eventToShortcut(e: KeyboardEvent): string {
    return this.normalize(e);
  }

  private rebuild(): void {
    this.active.clear();
    for (const actionId of this.defaults.keys()) {
      const shortcut = this.shortcutFor(actionId);
      if (shortcut) this.active.set(shortcut, actionId); // last registration wins on conflict
    }
  }

  private normalize(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.metaKey) parts.push("meta");
    if (e.ctrlKey) parts.push("ctrl");
    if (e.altKey) parts.push("alt");
    if (e.shiftKey) parts.push("shift");
    parts.push(e.key === " " ? "space" : e.key.toLowerCase());
    return parts.join("+");
  }

  private loadOverrides(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.overrides = new Map(Object.entries(JSON.parse(raw) as Record<string, string>));
    } catch { /* ignore */ }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(this.overrides)));
    } catch { /* ignore */ }
  }
}

export const ShortcutManager = new ShortcutManagerClass();
