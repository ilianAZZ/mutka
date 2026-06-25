import { invoke } from "@tauri-apps/api/core";
import type { FileItem } from "../types";

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
//      i.e. exactly what Finder shows. Fetched once per extension and cached.
//
// Like FileSystemRegistry, this is the documented exception to "only
// capabilities.ts calls invoke": it owns the icon_for_type system call. Icons
// are pure data (a data-URI string) — the renderer puts them in an <img src>,
// never innerHTML, so even an SVG override cannot execute script.
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
  /** In-flight native fetches, deduped by key. */
  private pending = new Map<string, Promise<string | null>>();

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

  /** Resolve the icon, fetching (and caching) the native icon if needed. */
  async resolve(item: FileItem): Promise<string | null> {
    const known = this.resolveSync(item);
    if (known) return known;
    return this.fetchNative(item);
  }

  private fetchNative(item: FileItem): Promise<string | null> {
    const key = nativeKey(item);
    const cached = this.nativeCache.get(key);
    if (cached) return Promise.resolve(cached);

    const inFlight = this.pending.get(key);
    if (inFlight) return inFlight;

    const promise = invoke<string>("icon_for_type", {
      extension: item.isDir ? null : item.extension ?? null,
      isDir: item.isDir,
      // Bundles and custom-icon folders resolve to their OWN icon, keyed by path;
      // everything else resolves by type (extension or generic folder).
      path: needsPathIcon(item) ? item.path : null,
    })
      .then((dataUri) => {
        this.nativeCache.set(key, dataUri);
        this.pending.delete(key);
        return dataUri;
      })
      .catch((err) => {
        console.error(`[FileIconRegistry] icon_for_type failed for ${key}:`, err);
        this.pending.delete(key);
        return null;
      });

    this.pending.set(key, promise);
    return promise;
  }
}

export const FileIconRegistry = new FileIconRegistryClass();
