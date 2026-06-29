import { useCallback, useEffect, useRef, useState } from "react";
import { EventBus } from "../core/event-bus/EventBus";
import { Events } from "../core/event-bus/events";
import { FileSystemRegistry } from "../core/file-system/FileSystemRegistry";
import { ListingStore } from "../core/stores/ListingStore";
import { LAST_DIR_KEY } from "../core/sandbox/capabilities";

export interface DirectoryListing {
  refresh: () => Promise<void>;
  loadError: string | null;
}

/**
 * Reads `currentDir` into the ListingStore and persists it as the last visited
 * directory (read back on next launch by the `core.home` module). Re-reads on
 * directory change and whenever a view preference (e.g. show-hidden) changes.
 */
export function useDirectoryListing(currentDir: string): DirectoryListing {
  const [loadError, setLoadError] = useState<string | null>(null);
  // Monotonic id so an out-of-order resolve (fast A→B→A nav, or a slow remote
  // read) can't overwrite the store with a stale directory's items.
  const seqRef = useRef(0);

  const refresh = useCallback(async () => {
    const seq = ++seqRef.current;
    try {
      const items = await FileSystemRegistry.readDir(currentDir);
      if (seq !== seqRef.current) return; // a newer refresh started — drop this result
      ListingStore.setItems(items);
      EventBus.emit(Events.Listing.loaded, { path: currentDir, count: items.length });
      setLoadError(null);
      if (currentDir.startsWith("/")) localStorage.setItem(LAST_DIR_KEY, currentDir);
    } catch (err) {
      if (seq !== seqRef.current) return;
      console.error("[App] readDir failed:", err);
      ListingStore.setItems([]);
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, [currentDir]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => EventBus.on(Events.View.changed, () => { refresh(); }), [refresh]);

  return { refresh, loadError };
}
