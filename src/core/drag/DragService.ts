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

const DRAG_ICON_PX = 32;

/** Synchronously resize a data-URI icon to DRAG_ICON_PX. Data-URIs decode
 *  instantly so img.complete is true and drawImage is synchronous — no async
 *  gap that would lose the pointer gesture. */
function shrinkIcon(dataUri: string): string {
  const img = new Image();
  img.src = dataUri;
  if (!img.complete || img.naturalWidth === 0) return dataUri;
  const canvas = document.createElement("canvas");
  canvas.width = DRAG_ICON_PX;
  canvas.height = DRAG_ICON_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUri;
  ctx.drawImage(img, 0, 0, DRAG_ICON_PX, DRAG_ICON_PX);
  return canvas.toDataURL("image/png");
}

class DragServiceClass {
  /**
   * Start a native drag of `paths`, previewed by `icon` (a data-URI or image
   * path). Resolves once the drag session ends. Safe to call inside a `dragstart`
   * handler — the plugin attaches to the in-flight pointer drag.
   */
  async start(paths: string[], icon?: string): Promise<void> {
    if (paths.length === 0) return;
    await startDrag({ item: paths, icon: icon || FALLBACK_ICON });
  }

  /**
   * Convenience for the file list: drag a set of items, using the first item's
   * already-cached icon as the drag preview. Resolves the icon SYNCHRONOUSLY (no
   * await before the drag starts) so the pointer gesture isn't lost.
   */
  startForItems(items: FileItem[]): Promise<void> {
    if (items.length === 0) return Promise.resolve();
    const raw = FileIconRegistry.resolveSync(items[0]);
    const icon = raw ? shrinkIcon(raw) : undefined;
    return this.start(items.map((i) => i.path), icon);
  }
}

export const DragService = new DragServiceClass();
