import { startDrag } from "@crabnebula/tauri-plugin-drag";
import type { FileItem } from "../types";
import { FileIconRegistry } from "../file-icons/FileIconRegistry";

// ─── Native OS file drag-out ──────────────────────────────────────────────────
//
// A WebView's HTML5 drag only carries text, so dropping a row on Finder or VSCode
// pastes the path instead of the file. This service starts a NATIVE macOS drag
// (NSDraggingSession with real file URLs, via tauri-plugin-drag) so an external
// app receives the files exactly as if they came from Finder.
//
// It is a thin system service (like FileSystemRegistry): the gateway exposes it as
// the `sys.startDrag` capability so modules can drag too, and the FileList wires
// the row drag gesture to `startForItems`.

// A 1×1 transparent PNG — the plugin requires a non-empty drag image. Used only
// when a row's real icon isn't cached yet (rare: the row is on-screen and loaded).
const FALLBACK_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwAEhgGAhqmM/wAAAABJRU5ErkJggg==";

// A module-supplied drag icon (via sys.startDrag) is untrusted. Allow only the
// shapes the plugin legitimately renders — a data:image URI, an http(s) URL, or
// an absolute file path — so a weird scheme (javascript:, …) never reaches it.
function safeDragIcon(icon?: string): string {
  const s = icon?.trim();
  if (!s) return FALLBACK_ICON;
  return /^https?:\/\//i.test(s) || /^data:image\//i.test(s) || s.startsWith("/") ? s : FALLBACK_ICON;
}

class DragServiceClass {
  /**
   * Start a native drag of `paths`, previewed by `icon` (a data-URI or image
   * path). Resolves once the drag session ends. Safe to call inside a `dragstart`
   * handler — the plugin attaches to the in-flight pointer drag.
   */
  async start(paths: string[], icon?: string): Promise<void> {
    if (paths.length === 0) return;
    await startDrag({ item: paths, icon: safeDragIcon(icon) });
  }

  /**
   * Convenience for the file list: drag a set of items, using the first item's
   * already-cached icon as the drag preview. Resolves the icon SYNCHRONOUSLY (no
   * await before the drag starts) so the pointer gesture isn't lost.
   */
  startForItems(items: FileItem[]): Promise<void> {
    if (items.length === 0) return Promise.resolve();
    const icon = FileIconRegistry.resolveSync(items[0]) ?? undefined;
    return this.start(items.map((i) => i.path), icon);
  }
}

export const DragService = new DragServiceClass();
