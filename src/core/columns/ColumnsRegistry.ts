import { EventBus } from "../event-bus/EventBus";
import { Events } from "../event-bus/events";
import { dirMatches } from "../sandbox/whenClause";
import { matchesItem } from "../sandbox/itemMatch";
import type { FileItem } from "../types";
import type { ColumnCell, ColumnContribution, ColumnDescriptor, ColumnRunner, ColumnCellState } from "./column.types";

interface ColumnEntry {
  moduleId: string;
  def: ColumnContribution;
  run: ColumnRunner;
}

const cacheKey = (columnId: string, item: FileItem): string =>
  `${columnId}::${item.path}::${item.modified}`;

/** Drop any field that doesn't meet the injection-safe contract. */
function sanitizeCell(cell: ColumnCell | null): ColumnCell | null {
  if (!cell) return null;
  const out: ColumnCell = {};
  if (typeof cell.text === "string") out.text = cell.text;
  if (typeof cell.icon === "string" && cell.icon.startsWith("data:image/")) out.icon = cell.icon;
  if (typeof cell.tint === "string" && cell.tint.startsWith("var(--")) out.tint = cell.tint;
  if (typeof cell.badge === "string") out.badge = cell.badge;
  return out;
}

/**
 * Holds every module-contributed list column and resolves their per-cell values
 * lazily, host-side. It owns BOTH levels of declarative gating — directory
 * (`dirMatch`) and item (`cellMatch`) — so a module's value provider is only
 * ever invoked for a cell that genuinely applies. Resolution is async and
 * cached by (column, path, mtime); a coalesced `columns:cell-resolved` event
 * tells the UI to re-read once a batch of values lands.
 */
class ColumnsRegistryClass {
  private readonly columns = new Map<string, ColumnEntry>();
  private readonly cache = new Map<string, ColumnCell | null>();
  private readonly inflight = new Set<string>();
  private flushScheduled = false;

  register(moduleId: string, defs: ColumnContribution[], run: ColumnRunner): void {
    for (const def of defs) this.columns.set(def.id, { moduleId, def, run });
    if (defs.length) EventBus.emit(Events.Columns.cellResolved);
  }

  unregister(moduleId: string): void {
    let removed = false;
    for (const [id, entry] of this.columns) {
      if (entry.moduleId !== moduleId) continue;
      this.columns.delete(id);
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${id}::`)) this.cache.delete(key);
      }
      removed = true;
    }
    if (removed) EventBus.emit(Events.Columns.cellResolved);
  }

  /** Columns whose directory gate passes for `dir`, in registration order. */
  columnsForDir(dir: string, homeDir: string): ColumnDescriptor[] {
    const out: ColumnDescriptor[] = [];
    for (const { def } of this.columns.values()) {
      if (dirMatches(def.dirMatch, dir, homeDir)) out.push(def);
    }
    return out;
  }

  /**
   * The current state of a cell. Returns `null` immediately (provider never
   * called) when the item fails the column's `cellMatch`. Otherwise serves the
   * cache, or kicks off resolution and returns `"loading"`.
   */
  getCell(columnId: string, item: FileItem): ColumnCellState {
    const entry = this.columns.get(columnId);
    if (!entry) return null;
    if (entry.def.cellMatch && !matchesItem(entry.def.cellMatch, item)) return null;

    const key = cacheKey(columnId, item);
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    if (this.inflight.has(key)) return "loading";

    this.inflight.add(key);
    Promise.resolve(entry.run(columnId, item))
      .then((cell) => this.cache.set(key, sanitizeCell(cell)))
      .catch(() => this.cache.set(key, null))
      .finally(() => {
        this.inflight.delete(key);
        this.scheduleNotify();
      });
    return "loading";
  }

  /** Coalesce a burst of resolutions into a single re-render signal. */
  private scheduleNotify(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    setTimeout(() => {
      this.flushScheduled = false;
      EventBus.emit(Events.Columns.cellResolved);
    }, 16);
  }
}

export const ColumnsRegistry = new ColumnsRegistryClass();
