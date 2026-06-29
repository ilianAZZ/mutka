import type { FileItem } from "../types";
import type { ColumnCell, ColumnContribution } from "../sandbox/protocol";

// Public column types for non-sandbox consumers (registry, hook, component).
// The canonical wire shapes live in sandbox/protocol.ts; these re-export them
// plus the host-side helpers that never cross the worker boundary.

export type { ColumnCell, ColumnContribution, ColumnDirMatch } from "../sandbox/protocol";

/** Produces a cell value for an item, in whichever runtime backs the module. */
export type ColumnRunner = (columnId: string, item: FileItem) => Promise<ColumnCell | null>;

/** Produces cell values for a batch of items in one dispatch (O(1) round-trips). */
export type ColumnBatchRunner = (columnId: string, items: FileItem[]) => Promise<(ColumnCell | null)[]>;

/** What a cell currently is: a resolved value, an empty cell, or pending. */
export type ColumnCellState = ColumnCell | null | "loading";

/** A column resolved for the current directory, ready to render. */
export type ColumnDescriptor = ColumnContribution;
