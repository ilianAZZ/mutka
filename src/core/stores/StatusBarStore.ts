import { EventBus } from "../event-bus/EventBus";
import { Events } from "../event-bus/events";
import type { StatusBarItem } from "../sandbox/protocol";

/** A status-bar item plus the module that owns it (for click → UI-event dispatch). */
export interface OwnedStatusBarItem extends StatusBarItem {
  moduleId: string;
}

/**
 * Holds the bottom status-bar items contributed by modules. Each module owns a
 * namespaced set of items it upserts/removes through the `statusbar` capability;
 * the core "N items selected" text is rendered separately by the StatusBar
 * component. React mirrors this via the "statusbar:changed" event.
 */
class StatusBarStoreClass {
  /** moduleId → (itemId → item). */
  private readonly byModule = new Map<string, Map<string, StatusBarItem>>();

  /** Add or replace one of a module's status-bar items. */
  set(moduleId: string, item: StatusBarItem): void {
    let items = this.byModule.get(moduleId);
    if (!items) {
      items = new Map();
      this.byModule.set(moduleId, items);
    }
    items.set(item.id, item);
    EventBus.emit(Events.StatusBar.changed);
  }

  /** Remove one of a module's status-bar items. */
  remove(moduleId: string, itemId: string): void {
    const items = this.byModule.get(moduleId);
    if (!items?.delete(itemId)) return;
    EventBus.emit(Events.StatusBar.changed);
  }

  /** All items across modules, flattened with their owning module id. */
  list(): OwnedStatusBarItem[] {
    const out: OwnedStatusBarItem[] = [];
    for (const [moduleId, items] of this.byModule) {
      for (const item of items.values()) out.push({ ...item, moduleId });
    }
    return out;
  }

  /** Drop every item owned by a module (on unregister). */
  disposeModule(moduleId: string): void {
    if (this.byModule.delete(moduleId)) EventBus.emit(Events.StatusBar.changed);
  }
}

export const StatusBarStore = new StatusBarStoreClass();
