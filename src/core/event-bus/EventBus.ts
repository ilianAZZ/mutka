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
    this.listeners.get(event)?.forEach((h) => h(...(args as [unknown?])));
  }
}

export const EventBus = new EventBusClass();
