import { EventBus } from "../event-bus/EventBus";
import { Events } from "../event-bus/events";

// Persisted per-column width overrides (built-in columns keyed by sort key —
// "date"/"type"/"size" — and custom columns by their id). The flexible "name"
// column has no stored width. Values are clamped and survive across sessions.

const KEY = "mutka.colWidths";
const MIN_WIDTH = 48;
const MAX_WIDTH = 800;

function load(): Record<string, number> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

class ColumnWidthStoreClass {
  private widths: Record<string, number> = load();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  /** Current override map (a fresh object whenever it changes). */
  getAll(): Record<string, number> {
    return this.widths;
  }

  /** Set a column's width (clamped). Emits immediately, persists debounced. */
  set(id: string, width: number): void {
    const w = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));
    if (this.widths[id] === w) return;
    this.widths = { ...this.widths, [id]: w };
    EventBus.emit(Events.Columns.widthsChanged);
    this.persist();
  }

  private persist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.widths));
      } catch {
        /* ignore */
      }
    }, 200);
  }
}

export const ColumnWidthStore = new ColumnWidthStoreClass();
