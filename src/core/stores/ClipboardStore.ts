import type { ClipboardState } from "../types";
import { EventBus } from "../event-bus/EventBus";
import { Events } from "../event-bus/events";

class ClipboardStoreClass {
  private _state: ClipboardState = { items: [], operation: null };

  get state(): ClipboardState {
    return this._state;
  }

  set(state: ClipboardState): void {
    this._state = state;
    EventBus.emit(Events.Clipboard.changed, state);
  }
}

export const ClipboardStore = new ClipboardStoreClass();
