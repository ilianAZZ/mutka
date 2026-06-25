import type { FileItem } from "../types";
import { EventBus } from "../event-bus/EventBus";
import { Events } from "../event-bus/events";

class SelectionStoreClass {
  private _items: FileItem[] = [];

  get items(): FileItem[] {
    return this._items;
  }

  set(items: FileItem[]): void {
    this._items = items;
    EventBus.emit(Events.Selection.changed, { items });
  }

  clear(): void {
    this.set([]);
  }
}

export const SelectionStore = new SelectionStoreClass();
