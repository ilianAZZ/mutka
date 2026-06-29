import type { EventMap } from "./events";

/** Conditional handler type: no-arg for undefined payloads, typed arg otherwise. */
type EventHandler<T> = T extends undefined ? () => void : (data: T) => void;

type InternalHandler = (data?: unknown) => void;

class EventBusClass {
  private listeners = new Map<string, Set<InternalHandler>>();

  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const h = handler as unknown as InternalHandler;
    this.listeners.get(event)!.add(h);
    return () => this.listeners.get(event)?.delete(h);
  }

  emit<K extends keyof EventMap>(
    event: K,
    ...args: EventMap[K] extends undefined ? [] : [data: EventMap[K]]
  ): void {
    // Snapshot + isolate: a handler that throws (or one that unsubscribes mid-
    // dispatch) must not starve the other subscribers of the same event.
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const h of [...handlers]) {
      try {
        h(...(args as [unknown?]));
      } catch (err) {
        console.error(`[EventBus] "${String(event)}" handler threw:`, err);
      }
    }
  }
}

export const EventBus = new EventBusClass();
