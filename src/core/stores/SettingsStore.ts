import { EventBus } from "../event-bus/EventBus";
import { Events } from "../event-bus/events";

/**
 * Whether the settings overlay is open. State only — opening it is a feature, so
 * it lives in the `core.settings` module (bound to ⌘,), which flips this store
 * through the `settings` capability. App renders the panel from `settings:changed`.
 */
class SettingsStoreClass {
  private _open = false;

  /** Whether the settings overlay is currently shown. */
  get open(): boolean {
    return this._open;
  }

  setOpen(value: boolean): void {
    if (this._open === value) return;
    this._open = value;
    EventBus.emit(Events.Settings.changed, { open: value });
  }

  toggle(): void {
    this.setOpen(!this._open);
  }
}

export const SettingsStore = new SettingsStoreClass();
