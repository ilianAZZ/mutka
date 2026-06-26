import { EventBus } from "../event-bus/EventBus";
import { Events } from "../event-bus/events";

/**
 * Whether the module-manager overlay is open. State only — mirrors SettingsStore.
 * The overlay is core UI (a dedicated panel for installing/enabling/disabling
 * modules), opened directly by React (e.g. from the Settings panel) via setOpen.
 * App renders the panel from the `modules-ui:changed` event.
 */
class ModulesStoreClass {
  private _open = false;

  /** Whether the module-manager overlay is currently shown. */
  get open(): boolean {
    return this._open;
  }

  setOpen(value: boolean): void {
    if (this._open === value) return;
    this._open = value;
    EventBus.emit(Events.ModulesUi.changed, { open: value });
  }

  toggle(): void {
    this.setOpen(!this._open);
  }
}

export const ModulesStore = new ModulesStoreClass();
