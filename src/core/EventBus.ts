type Handler = (data?: unknown) => void;

class EventBusClass {
  private listeners = new Map<string, Set<Handler>>();

  on(event: string, handler: Handler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  emit(event: string, data?: unknown) {
    this.listeners.get(event)?.forEach((h) => h(data));
  }
}

export const EventBus = new EventBusClass();
