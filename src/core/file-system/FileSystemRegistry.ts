import { invoke } from "@tauri-apps/api/core";
import type { FileItem } from "../types";
import { ViewStore } from "../stores/ViewStore";
import { EventBus } from "../event-bus/EventBus";
import { Events } from "../event-bus/events";

// =============================================================================
// FILE SYSTEM ROUTER
//
// The file source is no longer hard-wired to the local disk. A module can
// register a provider for a URI scheme (e.g. "webdav"); every directory listing,
// file open, and mutation is routed here: a path that matches a registered scheme
// goes to that provider, anything else (a normal absolute path) goes to Rust.
//
// This is what makes remote/virtual file systems (WebDAV/Nextcloud, archives,
// cloud drives) possible — read AND write — without the rest of the app knowing.
// =============================================================================

export interface FsProvider {
  /** List the entries of a directory path belonging to this provider. */
  list: (path: string) => Promise<FileItem[]>;
  /** Open a single file path belonging to this provider. */
  openFile: (path: string) => Promise<void>;
  /** Create a directory. Throw if the provider is read-only. */
  createFolder: (path: string) => Promise<void>;
  /** Create an empty file. Throw if the provider is read-only. */
  createFile: (path: string) => Promise<void>;
  /** Delete a file or directory. Throw if the provider is read-only. */
  deleteItem: (path: string) => Promise<void>;
  /** Rename / move within the same provider. Throw if read-only. */
  renameItem: (from: string, to: string) => Promise<void>;
  /** Copy sources into a directory belonging to this provider (local sources = upload). */
  copyFiles: (paths: string[], dest: string) => Promise<void>;
  /** Move same-provider sources into a directory belonging to this provider. */
  moveFiles: (paths: string[], dest: string) => Promise<void>;
}

class FileSystemRegistryClass {
  private providers = new Map<string, FsProvider>();

  registerProvider(scheme: string, provider: FsProvider): void {
    if (this.providers.has(scheme)) {
      console.warn(`[FileSystemRegistry] scheme "${scheme}" already registered — overriding`);
    }
    this.providers.set(scheme, provider);
  }

  unregisterProvider(scheme: string): void {
    this.providers.delete(scheme);
  }

  /** The provider for a path's scheme, or null for a plain local path. */
  private providerFor(path: string): FsProvider | null {
    const match = /^([a-z][a-z0-9+.-]*):/i.exec(path);
    return match ? this.providers.get(match[1].toLowerCase()) ?? null : null;
  }

  /** True when a path is handled by a registered provider (not the local disk). */
  isRemote(path: string): boolean {
    return this.providerFor(path) !== null;
  }

  async readDir(path: string): Promise<FileItem[]> {
    const provider = this.providerFor(path);
    // Remote providers list their own way (and may filter dotfiles client-side);
    // the local disk gets the show-hidden preference passed to Rust.
    return provider
      ? provider.list(path)
      : invoke<FileItem[]>("read_dir", { path, showHidden: ViewStore.showHidden });
  }

  async openItem(path: string): Promise<void> {
    const provider = this.providerFor(path);
    if (provider) return provider.openFile(path);
    try {
      await invoke("open_item", { path });
    } catch (err) {
      // No app claims this file (e.g. .DS_Store). Report it so the open-with
      // module can offer the picker, the way Finder does — not a hard failure.
      if (String(err).includes("NO_OPENER")) {
        const name = path.split("/").pop() || path;
        EventBus.emit(Events.File.openNoApp, { path, name });
        return;
      }
      throw err;
    }
  }

  async createFolder(path: string): Promise<void> {
    const provider = this.providerFor(path);
    if (provider) return provider.createFolder(path);
    await invoke("create_dir_cmd", { path });
  }

  async createFile(path: string): Promise<void> {
    const provider = this.providerFor(path);
    if (provider) return provider.createFile(path);
    await invoke("create_file", { path });
  }

  async deleteItem(path: string): Promise<void> {
    const provider = this.providerFor(path);
    if (provider) return provider.deleteItem(path);
    await invoke("delete_item", { path });
  }

  async renameItem(from: string, to: string): Promise<void> {
    const provider = this.providerFor(from);
    if (provider) {
      if (this.providerFor(to) !== provider) {
        throw new Error("Cannot rename across different file systems.");
      }
      return provider.renameItem(from, to);
    }
    await invoke("rename_item", { from, to });
  }

  /** Copy into `dest`. Routed by destination: a remote provider may upload local sources. */
  async copyFiles(paths: string[], dest: string): Promise<void> {
    const provider = this.providerFor(dest);
    if (provider) return provider.copyFiles(paths, dest);
    await invoke("copy_files", { paths, dest });
  }

  /** Move into `dest`. Same-provider sources move natively; local sources upload then delete. */
  async moveFiles(paths: string[], dest: string): Promise<void> {
    const provider = this.providerFor(dest);
    if (!provider) {
      await invoke("move_files", { paths, dest });
      return;
    }
    const local = paths.filter((p) => !this.isRemote(p));
    const sameProvider = paths.filter((p) => this.providerFor(p) === provider);
    // A source on a DIFFERENT provider is in neither bucket — fail loudly rather
    // than silently never moving it (and losing it from the user's mental model).
    if (local.length + sameProvider.length < paths.length) {
      throw new Error("Cannot move files between different file systems.");
    }
    if (sameProvider.length) await provider.moveFiles(sameProvider, dest);
    if (local.length) {
      await provider.copyFiles(local, dest); // upload
      for (const p of local) await invoke("delete_item", { path: p }); // then remove the local original
    }
  }
}

export const FileSystemRegistry = new FileSystemRegistryClass();
