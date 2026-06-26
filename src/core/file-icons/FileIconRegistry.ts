import { invoke } from "@tauri-apps/api/core";
import type { FileItem } from "../types";
import { EventBus } from "../event-bus/EventBus";
import { Events } from "../event-bus/events";

// =============================================================================
// FILE ICON REGISTRY
//
// Decides which image the UI shows for a file. Two layers, in priority order:
//
//   1. Module override — a module registers an image (base64 data-URI) for a set
//      of extensions via its `fileIcons` manifest contribution. This is how a
//      community author ships custom branding for a file type they own.
//   2. Native macOS icon — the default. Rust asks NSWorkspace / Launch Services
//      for the icon of a file TYPE (by extension, or the generic folder icon),
//      i.e. exactly what Finder shows. A whole folder's icons are rendered in one
//      off-main-thread batch (`prefetch` → `icons_for_types`) so opening a folder
//      never blocks on icons; results are cached in memory and on disk, and the
//      disk cache is warmed into memory at launch (`preload`).
//
// Like FileSystemRegistry, this is the documented exception to "only
// capabilities.ts calls invoke": it owns the icons_for_types / preload_icon_cache
// system calls. Icons are pure data (a data-URI string) — the renderer puts them
// in an <img src>, never innerHTML, so even an SVG override cannot execute script.
// =============================================================================

/** Max accepted size of a module-supplied data-URI (defence for untrusted modules). */
const MAX_ICON_BYTES = 64 * 1024;

/** Only base64 image data-URIs are accepted — rendered via <img>, so injection-safe. */
function isValidImageDataUri(value: string): boolean {
  return value.startsWith("data:image/") && value.length <= MAX_ICON_BYTES;
}

/** Items whose icon is specific to the item (not shared by type): bundles and
 * folders with a custom Finder icon. They resolve via the file path. */
function needsPathIcon(item: FileItem): boolean {
  return item.isPackage || item.hasCustomIcon;
}

/**
 * Cache key for the native icon of an item. Bundles (.app, …) and custom-icon
 * folders each have their own icon, so they key by path; plain folders share one
 * folder icon; files share an icon per extension.
 */
function nativeKey(item: FileItem): string {
  if (needsPathIcon(item)) return `path:${item.path}`;
  if (item.isDir) return "dir";
  return `ext:${(item.extension ?? "").toLowerCase()}`;
}

class FileIconRegistryClass {
  /** extension (lowercase) → data-URI, from module `fileIcons` contributions. */
  private overrides = new Map<string, string>();
  /** Reverse index so a module's overrides can be removed on unregister. */
  private byModule = new Map<string, string[]>();
  /** nativeKey → resolved data-URI (one fetch per file type, then cached forever). */
  private nativeCache = new Map<string, string>();

  /**
   * Register a module's icon override for a set of extensions. Invalid or
   * oversized images are skipped (logged) — a module can't break the listing.
   */
  register(moduleId: string, extensions: string[], image: string): void {
    if (!isValidImageDataUri(image)) {
      console.warn(`[FileIconRegistry] module "${moduleId}" supplied an invalid icon (must be a data:image/ URI ≤ ${MAX_ICON_BYTES} bytes) — ignored`);
      return;
    }
    const keys = this.byModule.get(moduleId) ?? [];
    for (const ext of extensions) {
      const key = ext.toLowerCase();
      this.overrides.set(key, image);
      keys.push(key);
    }
    this.byModule.set(moduleId, keys);
  }

  /** Remove all overrides a module registered (called on unregister). */
  unregister(moduleId: string): void {
    const keys = this.byModule.get(moduleId);
    if (!keys) return;
    for (const key of keys) this.overrides.delete(key);
    this.byModule.delete(moduleId);
  }

  /** The icon already known synchronously (override or cached native), else null. */
  resolveSync(item: FileItem): string | null {
    if (!item.isDir) {
      const override = this.overrides.get((item.extension ?? "").toLowerCase());
      if (override) return override;
    }
    return this.nativeCache.get(nativeKey(item)) ?? null;
  }

  /**
   * Warm the in-memory cache from the on-disk icon cache at launch, so a file
   * type seen in a previous session renders with zero IPC on the first folder
   * open (no placeholder flash). Emits "icons:settled" so any mounted rows pick
   * up their icons. Best-effort — a failure just means a cold cache.
   */
  async preload(): Promise<void> {
    try {
      const cached = await invoke<{ key: string; dataUri: string }[]>("preload_icon_cache");
      for (const { key, dataUri } of cached) this.nativeCache.set(key, dataUri);
    } catch (err) {
      console.error("[FileIconRegistry] preload_icon_cache failed:", err);
    } finally {
      EventBus.emit(Events.Icons.settled);
    }
  }

  /**
   * Render every not-yet-known native icon for a listing in ONE off-main-thread
   * call, then cache the results. This is what keeps opening a folder fast: the
   * whole folder's file types are rendered together off the UI thread instead of
   * one blocking call per type. Emits "icons:settled" when done (the timing hook
   * the telemetry module reads).
   */
  async prefetch(items: FileItem[]): Promise<void> {
    // One spec per unique native key that we don't already have (and that isn't
    // covered by a module override).
    const keys: string[] = [];
    const specs: { extension: string | null; isDir: boolean; path: string | null }[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      if (!item.isDir && this.overrides.get((item.extension ?? "").toLowerCase())) continue;
      const key = nativeKey(item);
      if (this.nativeCache.has(key) || seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
      specs.push({
        extension: item.isDir ? null : item.extension ?? null,
        isDir: item.isDir,
        // Bundles and custom-icon folders resolve to their OWN icon, keyed by path.
        path: needsPathIcon(item) ? item.path : null,
      });
    }

    if (specs.length === 0) {
      // Everything is already cached — still signal so timing closes out.
      EventBus.emit(Events.Icons.settled);
      return;
    }

    try {
      const results = await invoke<(string | null)[]>("icons_for_types", { specs });
      results.forEach((uri, i) => {
        if (uri) this.nativeCache.set(keys[i], uri);
      });
    } catch (err) {
      console.error("[FileIconRegistry] icons_for_types failed:", err);
    } finally {
      EventBus.emit(Events.Icons.settled);
    }
  }
}

export const FileIconRegistry = new FileIconRegistryClass();
