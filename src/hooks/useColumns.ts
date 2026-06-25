import { useEffect, useReducer } from "react";
import { ColumnsRegistry } from "../core/columns/ColumnsRegistry";
import { EventBus } from "../core/event-bus/EventBus";
import { Events } from "../core/event-bus/events";
import type { FileItem } from "../core/types";
import type { ColumnDescriptor, ColumnCellState } from "../core/columns/column.types";

/** Per-path map of each visible column's current cell state. */
export type ColumnCellData = Record<string, Record<string, ColumnCellState>>;

export interface UseColumnsResult {
  columns: ColumnDescriptor[];
  cellData: ColumnCellData;
}

/**
 * Bridges the (framework-agnostic) ColumnsRegistry into React. It computes the
 * columns that apply to `currentDir` and, for every visible item, reads each
 * cell's state — kicking off lazy resolution as a side effect. A re-render is
 * forced when modules change or when a batch of cell values resolves, so the
 * (purely presentational) FileList only ever receives plain data via props.
 */
export function useColumns(files: FileItem[], currentDir: string, homeDir: string): UseColumnsResult {
  const [, force] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const unsubs = [
      EventBus.on(Events.Module.registered, force),
      EventBus.on(Events.Module.unregistered, force),
      EventBus.on(Events.Columns.cellResolved, force),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const columns = ColumnsRegistry.columnsForDir(currentDir, homeDir);

  const cellData: ColumnCellData = {};
  if (columns.length) {
    for (const item of files) {
      const row: Record<string, ColumnCellState> = {};
      for (const col of columns) row[col.id] = ColumnsRegistry.getCell(col.id, item);
      cellData[item.path] = row;
    }
  }

  return { columns, cellData };
}
