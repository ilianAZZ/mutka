import type { FileItem } from "../types";
import { EventBus } from "../event-bus/EventBus";
import { Events } from "../event-bus/events";
import type { SortKey, SortState } from "./listing.types";

const SORT_STORAGE_KEY = "mutka.sort";

const SORT_KEYS: readonly SortKey[] = ["name", "date", "size", "type"];
function isSortKey(k: unknown): k is SortKey {
  return typeof k === "string" && (SORT_KEYS as readonly string[]).includes(k);
}

function loadSort(): SortState {
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY);
    if (raw) {
      // Validate: a syntactically-valid but wrong-shaped value (e.g. {"key":"color"})
      // would otherwise leave the list silently unsorted.
      const p = JSON.parse(raw) as Partial<SortState>;
      if (isSortKey(p.key) && (p.dir === "asc" || p.dir === "desc")) {
        return { key: p.key, dir: p.dir };
      }
    }
  } catch { /* ignore */ }
  return { key: "name", dir: "asc" };
}

function sortItems(items: FileItem[], sort: SortState): FileItem[] {
  const mul = sort.dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1; // folders always first
    let r = 0;
    switch (sort.key) {
      case "name": r = a.name.toLowerCase().localeCompare(b.name.toLowerCase()); break;
      case "date": r = a.modified - b.modified; break;
      case "size": r = a.size - b.size; break;
      case "type": r = (a.extension ?? "").localeCompare(b.extension ?? ""); break;
    }
    return r * mul;
  });
}

/**
 * Single source of truth for the current directory's listing: the raw items, the
 * active sort (and, later, filters), and the resulting VISIBLE order. Sorting is
 * behavior, not presentation — it lives here, not in a component. The UI renders
 * `items` and emits intent (e.g. a column click → toggleSort); modules read the
 * same visible order from the command snapshot.
 */
class ListingStoreClass {
  private _raw: FileItem[] = [];
  private _sort: SortState = loadSort();
  private _visible: FileItem[] = [];

  /** The visible items, in display order (sorted + filtered). */
  get items(): FileItem[] {
    return this._visible;
  }

  get sort(): SortState {
    return this._sort;
  }

  /** Replace the raw directory contents (e.g. after a readDir). */
  setItems(items: FileItem[]): void {
    this._raw = items;
    this.recompute();
  }

  setSort(sort: SortState): void {
    this._sort = sort;
    this.persist();
    this.recompute();
  }

  /** Sort by a column: same column flips direction, a new column starts ascending. */
  toggleSort(key: SortKey): void {
    this.setSort(
      this._sort.key === key
        ? { key, dir: this._sort.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  private recompute(): void {
    this._visible = sortItems(this._raw, this._sort);
    EventBus.emit(Events.Listing.changed, { items: this._visible, sort: this._sort });
  }

  private persist(): void {
    try { localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(this._sort)); } catch { /* ignore */ }
  }
}

export const ListingStore = new ListingStoreClass();
