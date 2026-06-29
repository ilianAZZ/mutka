import { EventBus } from "../event-bus/EventBus";
import { Events } from "../event-bus/events";
import { dirMatches } from "../sandbox/whenClause";
import { matchesItem } from "../sandbox/itemMatch";
import type { FileItem } from "../types";
import type { ColumnCell, ColumnContribution, ColumnDescriptor, ColumnRunner, ColumnBatchRunner, ColumnCellState } from "./column.types";

interface ColumnEntry {
  moduleId: string;
  def: ColumnContribution;
  run: ColumnRunner;
  runBatch?: ColumnBatchRunner;
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
 *
 * Batching: uncached cells are queued during a synchronous render pass and
 * flushed as one dispatch per column via a microtask, so a worker-backed
 * column issues O(1) postMessage round-trips per column, not O(rows).
 */
class ColumnsRegistryClass {
  private readonly columns = new Map<string, ColumnEntry>();
  private readonly cache = new Map<string, ColumnCell | null>();
  private readonly inflight = new Set<string>();
  private notifyScheduled = false;
  private batchQueue = new Map<string, FileItem[]>();
  private batchScheduled = false;

  register(moduleId: string, defs: ColumnContribution[], run: ColumnRunner, runBatch?: ColumnBatchRunner): void {
    for (const def of defs) this.columns.set(def.id, { moduleId, def, run, runBatch });
    if (defs.length) EventBus.emit(Events.Columns.cellResolved);
  }

  unregister(moduleId: string): void {
    let removed = false;
    for (const [id, entry] of this.columns) {
      if (entry.moduleId !== moduleId) continue;
      this.columns.delete(id);
      this.batchQueue.delete(id);
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
   * cache, or enqueues it for batched resolution and returns `"loading"`.
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
    this.enqueueBatch(columnId, item);
    return "loading";
  }

  private enqueueBatch(columnId: string, item: FileItem): void {
    let queue = this.batchQueue.get(columnId);
    if (!queue) { queue = []; this.batchQueue.set(columnId, queue); }
    queue.push(item);
    if (!this.batchScheduled) {
      this.batchScheduled = true;
      queueMicrotask(() => this.flushBatch());
    }
  }

  private flushBatch(): void {
    this.batchScheduled = false;
    const snapshot = this.batchQueue;
    this.batchQueue = new Map();

    for (const [columnId, items] of snapshot) {
      const entry = this.columns.get(columnId);
      if (!entry) {
        for (const item of items) this.settleCell(columnId, item, null);
        continue;
      }
      if (entry.runBatch) {
        entry.runBatch(columnId, items)
          .then((cells) => {
            for (let i = 0; i < items.length; i++) {
              this.settleCell(columnId, items[i], sanitizeCell(cells[i] ?? null));
            }
          })
          .catch(() => {
            for (const item of items) this.settleCell(columnId, item, null);
          });
      } else {
        for (const item of items) {
          Promise.resolve(entry.run(columnId, item))
            .then((cell) => this.settleCell(columnId, item, sanitizeCell(cell)))
            .catch(() => this.settleCell(columnId, item, null));
        }
      }
    }
  }

  private settleCell(columnId: string, item: FileItem, value: ColumnCell | null): void {
    const key = cacheKey(columnId, item);
    this.cache.set(key, value);
    this.inflight.delete(key);
    this.scheduleNotify();
  }

  /** Coalesce a burst of resolutions into a single re-render signal. */
  private scheduleNotify(): void {
    if (this.notifyScheduled) return;
    this.notifyScheduled = true;
    setTimeout(() => {
      this.notifyScheduled = false;
      EventBus.emit(Events.Columns.cellResolved);
    }, 16);
  }
}

export const ColumnsRegistry = new ColumnsRegistryClass();
