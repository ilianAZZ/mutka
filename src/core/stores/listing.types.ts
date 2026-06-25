import type { FileItem } from "../types";

/** Which column the listing is sorted by. */
export type SortKey = "name" | "date" | "size" | "type";

export interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

/** Payload of the `listing:changed` event: the visible items + the active sort. */
export interface ListingSnapshot {
  items: FileItem[];
  sort: SortState;
}
