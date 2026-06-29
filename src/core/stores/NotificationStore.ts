import { EventBus } from "../event-bus/EventBus";
import { Events } from "../event-bus/events";

// =============================================================================
// NOTIFICATION STORE — transient, in-app toasts so a user gets VISUAL feedback
// instead of having to open the dev console. It surfaces the two error channels
// that otherwise only hit console.* :
//   • built-in module action failures  → the `error:action` EventBus event
//   • community (worker) module errors  → pushed directly by SandboxHost when a
//     handler throws (e.g. a denied permission)
// plus app-level success/info messages (module installed, deleted, …).
// =============================================================================

export type NotificationKind = "error" | "warning" | "success" | "info";

export interface Notification {
  id: number;
  kind: NotificationKind;
  title: string;
  /** Optional secondary line (e.g. the error message). */
  message?: string;
  /** Auto-dismiss after this many ms; 0 means it stays until dismissed. */
  timeout: number;
}

type Listener = (items: Notification[]) => void;

/** Most recent notifications kept at once (older ones drop off the top). */
const MAX_ITEMS = 5;

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

class NotificationStoreClass {
  private items: Notification[] = [];
  private listeners = new Set<Listener>();
  private seq = 0;

  /** Current notifications, newest last. */
  getAll(): Notification[] {
    return this.items;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    const snapshot = [...this.items];
    this.listeners.forEach((l) => l(snapshot));
  }

  /** Add a notification; returns its id. Capped to the most recent MAX_ITEMS. */
  push(notification: Omit<Notification, "id">): number {
    const id = ++this.seq;
    this.items = [...this.items, { id, ...notification }].slice(-MAX_ITEMS);
    this.emit();
    return id;
  }

  error(title: string, message?: string): number {
    return this.push({ kind: "error", title, message, timeout: 0 });
  }

  success(title: string, message?: string): number {
    return this.push({ kind: "success", title, message, timeout: 4000 });
  }

  info(title: string, message?: string): number {
    return this.push({ kind: "info", title, message, timeout: 4000 });
  }

  dismiss(id: number): void {
    const next = this.items.filter((n) => n.id !== id);
    if (next.length === this.items.length) return;
    this.items = next;
    this.emit();
  }

  /** Wire the global error sources once (call from App startup). */
  init(): void {
    EventBus.on(Events.Error.action, ({ actionId, error }) => {
      this.error(`“${actionId}” failed`, messageOf(error));
    });
  }
}

export const NotificationStore = new NotificationStoreClass();
